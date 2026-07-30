import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // Gemini API client setup
  const getAiClient = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is missing.");
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  };

  // API endpoint for proxying DeepSeek / OpenAI-compatible API tests
  app.post("/api/deepseek/test", async (req, res) => {
    try {
      const { apiKey, baseUrl, model } = req.body;
      if (!apiKey || typeof apiKey !== "string") {
        return res.status(400).json({ success: false, message: "کلید API وارد نشده است." });
      }

      const cleanBaseUrl = (baseUrl || "https://api.gapgpt.app/v1").replace(/\/$/, "");
      const endpoint = `${cleanBaseUrl}/chat/completions`;
      const targetModel = model || "deepseek-chat";

      const apiRes = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey.trim()}`
        },
        body: JSON.stringify({
          model: targetModel,
          messages: [{ role: "user", content: "سلام، تست آنلاین ارتباط با API" }],
          max_tokens: 10
        })
      });

      if (apiRes.ok) {
        const data = await apiRes.json().catch(() => ({}));
        return res.json({
          success: true,
          message: `اتصال با موفقیت برقرار شد! پاسخ مدل (${data.model || targetModel}) دریافت گردید.`
        });
      } else {
        const errJson = await apiRes.json().catch(() => ({}));
        let errMsg = errJson?.error?.message || errJson?.message || apiRes.statusText;
        if (errMsg.toLowerCase().includes("authentication") || errMsg.toLowerCase().includes("api key") || errMsg.toLowerCase().includes("invalid")) {
          errMsg = "کلید API وارد شده نامعتبر یا منقضی می‌باشد. لطفاً کلید API معتبر خود را از پنل DeepSeek وارد نمایید.";
        }
        return res.status(apiRes.status).json({
          success: false,
          message: `خطا در اتصال (کد ${apiRes.status}): ${errMsg}`
        });
      }
    } catch (error: any) {
      console.error("DeepSeek proxy test error:", error);
      return res.status(500).json({
        success: false,
        message: `خطای سرور هنگام اتصال: ${error?.message || "نامشخص"}`
      });
    }
  });

  // API endpoint for proxying DeepSeek article generation
  app.post("/api/deepseek/generate", async (req, res) => {
    try {
      const { apiKey, baseUrl, model, systemPrompt, userPrompt } = req.body;
      if (!apiKey) {
        return res.status(400).json({ error: "کلید API الزامی است." });
      }

      const cleanBaseUrl = (baseUrl || "https://api.deepseek.com/v1").replace(/\/$/, "");
      const endpoint = `${cleanBaseUrl}/chat/completions`;
      const targetModel = model || "deepseek-chat";

      const apiRes = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey.trim()}`
        },
        body: JSON.stringify({
          model: targetModel,
          messages: [
            { role: "system", content: systemPrompt || "شما یک دستیار هوش مصنوعی هستید." },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.7
        })
      });

      if (apiRes.ok) {
        const data = await apiRes.json();
        return res.json(data);
      } else {
        const errJson = await apiRes.json().catch(() => ({}));
        return res.status(apiRes.status).json({
          error: errJson?.error?.message || errJson?.message || apiRes.statusText
        });
      }
    } catch (error: any) {
      console.error("DeepSeek proxy generate error:", error);
      return res.status(500).json({ error: error?.message || "خطای سرور" });
    }
  });

  // API endpoint for proxying DeepSeek Chatbot messages
  app.post("/api/deepseek/chat", async (req, res) => {
    try {
      const { apiKey, baseUrl, model, systemPrompt, messages } = req.body;
      if (!apiKey) {
        return res.status(400).json({ error: "کلید API الزامی است." });
      }

      const cleanBaseUrl = (baseUrl || "https://api.gapgpt.app/v1").replace(/\/$/, "");
      const endpoint = `${cleanBaseUrl}/chat/completions`;
      const targetModel = model || "deepseek-chat";

      const formattedMessages: Array<{ role: string; content: string }> = [];
      if (systemPrompt) {
        formattedMessages.push({ role: "system", content: systemPrompt });
      }
      if (Array.isArray(messages)) {
        formattedMessages.push(...messages);
      }

      const apiRes = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey.trim()}`
        },
        body: JSON.stringify({
          model: targetModel,
          messages: formattedMessages,
          temperature: 0.7
        })
      });

      if (apiRes.ok) {
        const data = await apiRes.json();
        return res.json(data);
      } else {
        const errJson = await apiRes.json().catch(() => ({}));
        let rawMsg = errJson?.error?.message || errJson?.message || apiRes.statusText;
        if (rawMsg.toLowerCase().includes("authentication") || rawMsg.toLowerCase().includes("api key") || rawMsg.toLowerCase().includes("invalid")) {
          rawMsg = "کلید API چت‌بات نامعتبر یا منقضی است. لطفاً کلید معتبر DeepSeek را در پنل مدیریت وارد نمایید.";
        }
        return res.status(apiRes.status).json({
          error: rawMsg
        });
      }
    } catch (error: any) {
      console.error("DeepSeek proxy chat error:", error);
      return res.status(500).json({ error: error?.message || "خطای سرور" });
    }
  });


  // API endpoint for Gemini AI assistance in SEO & CMS
  app.post("/api/gemini/generate", async (req, res) => {
    try {
      const { prompt, systemInstruction, type } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "متن درخواست الزامی است." });
      }

      const ai = getAiClient();
      
      let defaultSys = "شما یک دستیار متخصص سئو، وب۳ و محتوای سولانا برای پلتفرم سولمینت (solmint.ir) هستید. پاسخ‌های خود را به زبان فارسی روان، جذاب و استاندارد سئو ارائه دهید.";
      if (type === "seo_summary") {
        defaultSys = "شما دستیار تولید چکیده مقاله استاندارد سئو (Meta Description) به زبان فارسی هستید. چکیده باید بین ۱۲۰ تا ۱۶۰ کاراکتر باشد، جذاب باشد و کلمات کلیدی اصلی را شامل شود.";
      } else if (type === "seo_keywords") {
        defaultSys = "شما متخصص تحقیق کلمات کلیدی وب۳ و سولانا هستید. لیستی از کلمات کلیدی کاما جدا شده برای موضوع داده شده به فارسی ارائه دهید.";
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: {
          systemInstruction: systemInstruction || defaultSys,
          temperature: 0.7,
        },
      });

      const resultText = response.text || "";
      return res.json({ result: resultText });
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      return res.status(500).json({ 
        error: error.message || "خطا در ارتباط با هوش مصنوعی. لطفاً کلید GEMINI_API_KEY را بررسی کنید." 
      });
    }
  });

  // Mock live Solana Ticker API if needed
  app.get("/api/solana/status", (req, res) => {
    res.json({
      price: 184.25 + (Math.random() * 2 - 1),
      change24h: +4.38,
      tps: 2850 + Math.floor(Math.random() * 150),
      avgFeeUsd: 0.00025,
      avgFeeSol: 0.000005,
      status: "Mainnet Beta Online",
      slot: 284910283 + Math.floor(Math.random() * 100),
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Solmint Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
