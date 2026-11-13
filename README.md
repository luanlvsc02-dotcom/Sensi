# SMART SENSI AI

Assistente de sensibilidade para Free Fire. **Ferramenta externa**: calcula valores
recomendados e você os digita manualmente no jogo. Funciona 100% offline, sem contas
nem serviços pagos.

## O que está implementado
- Painel: sistema, modelo, resolução, taxa de atualização (estimada), DPI (só informação), gráfico da configuração.
- Sensibilidades individuais: Geral, Ponto vermelho, 2x, 4x, AWM, Olhadinha.
- Diagnóstico A/B/C (passa da cabeça / abaixo / instável) com escopo por mira e intensidade.
- Calibração por sintomas com passos limitados (máx. 8 pontos por parâmetro por rodada).
- Histórico com resultado (melhorou / igual / piorou): o próximo cálculo usa esse retorno
  (passo menor se melhorou, invertido se piorou, maior se ficou igual). Gráfico de evolução.
- Perfis: criar, usar, duplicar, renomear, restaurar original, excluir; backup JSON.
- Dados completos exigidos: se faltar valor, o app pede em vez de inventar resultado.

## Como funciona o motor (`www/engine.js`)
Heurística transparente, sem IA externa: cada sintoma define uma direção; o passo é
`2 pts × intensidade × peso do parâmetro × fator de feedback`. Também verifica a ordem
Geral ≥ Ponto vermelho ≥ 2x ≥ 4x ≥ AWM e diferenças grandes entre miras vizinhas.
**Não há garantia de que um valor funcione para você**: são ajustes graduais para testar.
O app não conhece a sensibilidade "ideal" de cada aparelho; ele não inventa isso.

## Testar
```
npm test            # 10 testes do motor (Node, sem dependências)
npx serve www       # abre o app no navegador
```

## Instalar sem loja (PWA)
Hospede a pasta `www/` em qualquer HTTPS estático (GitHub Pages, Netlify gratuito) e abra:
- Android/Chrome: menu → *Instalar app*.
- iPhone/Safari: Compartilhar → *Adicionar à Tela de Início*.

## Android (APK)
Requisitos: Node 18+, Android Studio, JDK 17.
```
npm install
npx cap add android
npm run android      # abre no Android Studio → Build > Build APK(s)
```

## iOS / App Store
Requisitos: Mac com Xcode e conta Apple Developer (paga, exigência da Apple).
```
npm install
npx cap add ios
npm run ios          # abre no Xcode → configure Team/Bundle ID → Product > Archive
```
Antes de publicar: troque `appId` em `capacitor.config.json`, gere os ícones PNG
(1024×1024) a partir de `www/icon.svg` e adicione política de privacidade
(o app não coleta nem envia dados). A Apple exige também que o app não se apresente
como oficial do Free Fire: não use logo/nome da Garena. Descreva como app independente.

## Segurança / antibanimento
O app não injeta código, não lê/modifica memória ou arquivos do jogo, não usa macros,
overlay, automação de toque, rede do jogo nem contorna anticheat. Isso minimiza risco,
mas **não existe garantia de risco zero**: as regras são da Garena.

## Limitações conhecidas
- Navegadores não expõem o modelo exato (principalmente no iPhone): há campo manual.
- A taxa de atualização é estimada em ~40 quadros.
- Dados ficam em `localStorage` (offline). Faça backup JSON na aba Perfis, pois o
  sistema pode limpar dados do navegador.
- Não foi possível compilar APK/IPA neste ambiente (sem rede nem SDKs).
