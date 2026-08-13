import fs from 'node:fs';
const p='src/App.tsx';
let s=fs.readFileSync(p,'utf8');
s=s.replace("import { AppShowcaseAdminPanel } from './components/AppShowcaseAdminPanel';", "const AppShowcaseAdminPanel = lazy(() => import('./components/AppShowcaseAdminPanel').then(m => ({default:m.AppShowcaseAdminPanel})));" );
s=s.replace("import { MemeTickerAdminPanel } from './components/MemeTickerAdminPanel';", "const MemeTickerAdminPanel = lazy(() => import('./components/MemeTickerAdminPanel').then(m => ({default:m.MemeTickerAdminPanel})));" );
s=s.replace("import { SolanaPricePage } from './components/SolanaPricePage';", "const SolanaPricePage = lazy(() => import('./components/SolanaPricePage').then(m => ({default:m.SolanaPricePage})));" );
fs.writeFileSync(p,s);
console.log('performance split applied');
