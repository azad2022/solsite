const AUTH_MD = `# auth.md

## Solmint agent authentication

Solmint is a public Solana, DeFi, Web3 and cryptocurrency information platform. This document describes authentication and agent registration for automated clients.

### Agent audience

AI agents and other automated clients may access publicly available Solmint content for read-only discovery and retrieval.

### Public access

Public articles, guides, taxonomy pages and other public website content do not require authentication. Agents should prefer the Markdown representation of public pages by sending:

\`Accept: text/markdown\`

Authentication is not required for public content.

### Agent registration

Solmint does not currently expose a public agent-registration endpoint, OAuth authorization server, or API credential provisioning flow for third-party agents. Do not attempt to create an account or provision credentials through an undocumented endpoint.

### Authentication methods

No agent-specific authentication method is currently advertised for the public website. Human/admin authentication is separate from public agent access and is not an agent registration protocol.

### Credential use

Do not submit passwords, session cookies, private keys, seed phrases, wallet secrets, or other sensitive credentials to Solmint through automated requests unless an explicitly documented future API requires them.

### Machine-readable discovery

For public content, agents can use the website's Markdown content negotiation. The canonical service origin is:

https://solmint.ir/

For future authenticated APIs, Solmint will publish the applicable OAuth Protected Resource Metadata and authorization-server metadata before requiring agent credentials.
`;

export const onRequest: PagesFunction = async () => {
  return new Response(AUTH_MD, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  });
};
