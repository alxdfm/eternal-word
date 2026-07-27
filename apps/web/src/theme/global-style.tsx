'use client'

import { createGlobalStyle } from 'styled-components'

/**
 * "O Códice de Luz" — tokens as CSS custom properties (ADR
 * 2026-07-26_mini-design-system-codice-de-luz). Three layers:
 *   :root                         → vellum (light, the daylight base)
 *   @media (prefers-color-scheme) → ink (dark, the hero) when unset
 *   :root[data-theme="…"]         → explicit override the toggle stamps on <html>
 *
 * The theme object (theme.ts) maps semantic names onto these vars, so switching
 * a theme is one attribute on <html> — no React re-render, no flash.
 */
export const GlobalStyle = createGlobalStyle`
  :root {
    --bg:#E7E0CD; --panel:#EFE9DA; --panel2:#F4EFE2; --rule:#D6CEB6; --rule-soft:#E0D9C4;
    --text:#1C1D27; --muted:#6C6852; --faint:#98936F;
    --gold:#956A10; --gold-lit:#B98A22; --gold-on:#FBF6E9; --gold-rgb:149,106,16;
    --lapis:#2C42A0; --lapis-soft:#5468BE; --pending:#8A6114; --danger:#B4231F;
    --cell0:#DBD3BB; --surface:#EDE7D6;
    --shadow:0 1px 2px rgba(28,29,39,.05), 0 8px 26px -14px rgba(28,29,39,.22);
    --glow:none;
    color-scheme:light;

    --serif:"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,"Times New Roman",serif;
    --sans:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
    --mono:ui-monospace,"SF Mono","JetBrains Mono",Menlo,Consolas,monospace;
    --wrap:1148px;
  }

  @media (prefers-color-scheme:dark){
    :root{
      --bg:#0F1017; --panel:#161927; --panel2:#1C2033; --rule:#2A2E42; --rule-soft:#20243550;
      --text:#ECE6D6; --muted:#9DA0B4; --faint:#63667E;
      --gold:#E0AE3C; --gold-lit:#F6D480; --gold-on:#12131C; --gold-rgb:224,174,60;
      --lapis:#8098F4; --lapis-soft:#5C7CF0; --pending:#D69B4E; --danger:#F08A84;
      --cell0:#191D2B; --surface:#12131C;
      --shadow:0 1px 2px rgba(0,0,0,.4), 0 18px 44px -20px rgba(0,0,0,.7);
      --glow:0 0 22px -6px rgba(224,174,60,.45);
      color-scheme:dark;
    }
  }

  :root[data-theme="light"]{
    --bg:#E7E0CD; --panel:#EFE9DA; --panel2:#F4EFE2; --rule:#D6CEB6; --rule-soft:#E0D9C4;
    --text:#1C1D27; --muted:#6C6852; --faint:#98936F;
    --gold:#956A10; --gold-lit:#B98A22; --gold-on:#FBF6E9; --gold-rgb:149,106,16;
    --lapis:#2C42A0; --lapis-soft:#5468BE; --pending:#8A6114; --danger:#B4231F;
    --cell0:#DBD3BB; --surface:#EDE7D6;
    --shadow:0 1px 2px rgba(28,29,39,.05), 0 8px 26px -14px rgba(28,29,39,.22);
    --glow:none;
    color-scheme:light;
  }

  :root[data-theme="dark"]{
    --bg:#0F1017; --panel:#161927; --panel2:#1C2033; --rule:#2A2E42; --rule-soft:#20243550;
    --text:#ECE6D6; --muted:#9DA0B4; --faint:#63667E;
    --gold:#E0AE3C; --gold-lit:#F6D480; --gold-on:#12131C; --gold-rgb:224,174,60;
    --lapis:#8098F4; --lapis-soft:#5C7CF0; --pending:#D69B4E; --danger:#F08A84;
    --cell0:#191D2B; --surface:#12131C;
    --shadow:0 1px 2px rgba(0,0,0,.4), 0 18px 44px -20px rgba(0,0,0,.7);
    --glow:0 0 22px -6px rgba(224,174,60,.45);
    color-scheme:dark;
  }

  *{ box-sizing:border-box }
  html{ -webkit-text-size-adjust:100% }
  body{
    margin:0; background:var(--bg); color:var(--text);
    font-family:var(--sans); font-size:16px; line-height:1.55;
    -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility;
    font-feature-settings:"kern" 1;
  }

  /* faint vellum/ink texture — subtle, never busy */
  body::before{
    content:""; position:fixed; inset:0; pointer-events:none; z-index:0; opacity:.5;
    background:
      radial-gradient(1100px 640px at 82% -6%, rgba(var(--gold-rgb),.06), transparent 60%),
      radial-gradient(900px 620px at -8% 8%, rgba(92,124,240,.05), transparent 55%);
  }

  a{ color:var(--lapis); text-underline-offset:2px; text-decoration-thickness:1px }
  ::selection{ background:rgba(var(--gold-rgb),.28) }
  :focus-visible{ outline:2px solid var(--lapis); outline-offset:2px; border-radius:3px }

  @media (prefers-reduced-motion:reduce){
    *{ animation:none !important; transition:none !important }
  }
`
