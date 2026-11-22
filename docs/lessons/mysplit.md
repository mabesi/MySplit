# Lições Aprendidas — MySplit

## Metadados

| Campo | Valor |
|---|---|
| Projeto | MySplit (`mysplit`) |
| Repositório | `/home/plinio/Projetos/ReactNative/mysplit` |
| Tipo | Aplicativo mobile React Native + Expo Router + Firebase |
| Versão declarada | `1.0.2` em `package.json` e `app.config.ts` |
| Commit de referência | `93d5099` — *Feat: shared sync status, explicit settlements and error boundary* (2026-11-21) |
| Estado da árvore | `package.json` e `package-lock.json` modificados e não commitados (bump para `1.0.2`) |
| Data da análise | 2026-11-21 |
| Documento | `docs/lessons/mysplit.md` (novo; não havia `docs/` no repositório) |
| Escopo | README, `package.json`, `app.config.ts`, `eas.json`, `tsconfig.json`, `eslint.config.js`, `firestore.rules`, `app/`, `components/`, `context/`, `services/`, `utils/`, `hooks/`, `i18n/`, `types/`, `.agent/` e histórico Git recente |
| Código de produção alterado | Não |
| Verificações executadas | `npx tsc --noEmit` → saída 0; `npm run lint` → saída 0 |
| Testes automatizados | Nenhum arquivo de teste e nenhum runner configurado no repositório |
| CI | Nenhum workflow de CI no repositório |

> Este documento é baseado no código e no histórico verificados. Itens já corrigidos aparecem marcados como **corrigido** e não são repetidos como pendência.

---

## Legenda

| Tag | Significado |
|---|---|
| **BASE** | Prática adotada como base reutilizável; recomendada em projetos semelhantes. |
| **ADAPT** | Prática reutilizável com adaptação ao contexto (plataforma, backend, escala). |
| **SPEC** | Decisão específica do MySplit; deve ser reavaliada antes de copiar. |
| **ANTI** | Anti-padrão observado ou evitado explicitamente; serve como alerta. |
| **DEBT** | Dívida técnica ou pendência consciente, ainda não resolvida. |

Status usados no índice:

| Status | Significado |
|---|---|
| `vigente` | Prática/estrutura ativa no código atual. |
| `corrigido` | Problema já corrigido; a lição permanece como prevenção. |
| `pendente` | Pendência confirmada no estado atual. |
| `monitorar` | Decisão aceita com risco conhecido; exige acompanhamento. |

---

## Índice de lições

| ID | Lição | Tags | Status |
|---|---|---|---|
| L-001 | Outbox durável com aplicação otimista e FIFO por grupo | BASE | vigente |
| L-002 | Transações idempotentes no servidor | BASE | vigente |
| L-003 | `memberIds`/`activeMemberIds` derivados para regras do Firestore | SPEC | vigente |
| L-004 | Cache miss não é prova de exclusão | BASE | corrigido |
| L-005 | Status de sincronização a partir do snapshot já aberto | ADAPT | corrigido |
| L-006 | Datas de calendário como `YYYY-MM-DD` | BASE | corrigido |
| L-007 | Dinheiro em unidades menores e parsing localizado | BASE | corrigido |
| L-008 | Uma moeda por grupo, sem conversão automática | SPEC | vigente |
| L-009 | Regras de membros virtuais centralizadas | SPEC | vigente |
| L-010 | Miniatura base64 com fallback para módulo nativo ausente | ADAPT | corrigido |
| L-011 | Autenticação anônima e recuperação de identidade | SPEC | monitorar |
| L-012 | ID do grupo como segredo de convite | SPEC | monitorar |
| L-013 | Assinaturas compartilhadas e limpeza de listeners | BASE | corrigido |
| L-014 | `ErrorBoundary` + logger central | BASE | vigente |
| L-015 | Anúncios condicionados a configuração remota | ADAPT | vigente |
| L-016 | Descoberta de grupos com queries limitadas | SPEC | vigente |
| L-017 | Settlement explícito com fallback legado | BASE | corrigido |
| L-018 | Confirmação de compartilhamento visível | ADAPT | corrigido |
| L-019 | Deep link de convite | SPEC | vigente |
| L-020 | Proteção contra duplo toque/submissão | BASE | corrigido |
| L-021 | Migração de dados legados sem perda | BASE | vigente |
| L-022 | Merge não destrutivo de snapshot local | BASE | corrigido |
| L-023 | Ausência de testes automatizados, CI e script de typecheck | DEBT | pendente |
| L-024 | Política de privacidade e preparação para loja | DEBT | pendente |
| L-025 | Publicação manual das regras do Firestore | DEBT | pendente |
| L-026 | Strings de UI fora do i18n e `alert()` global | DEBT | pendente |
| L-027 | Configuração/env não utilizada e documentação desatualizada | DEBT | pendente |
| L-028 | Build, versionamento e perfis EAS | ADAPT | vigente |
| L-029 | Segredos e scripts locais | DEBT | pendente |

---

## Resumo executivo

### O que funcionou

- **Offline-first com outbox durável**: mutações são aplicadas em `AsyncStorage` e enfileiradas em `OperationQueue`; o `OperationProcessor` reaplica em ordem por grupo. A fila é persistida e, por construção, sobrevive a reinícios; ela substituiu a reconciliação destrutiva de snapshot inteiro.
- **Cálculo financeiro correto**: valores são convertidos para unidades menores (`toMinorUnits`/`fromMinorUnits`) e a divisão distribui o resto unidade a unidade em `calculateBalances`, evitando perda de centavos.
- **Datas sem deslocamento de fuso**: novas despesas carregam `dateString` `YYYY-MM-DD` e usam componentes locais; a data legada por timestamp continua legível.
- **Regras de membros centralizadas**: `utils/memberLogic.ts` é usado tanto pelo contexto local quanto pelo `FirebaseService`, reduzindo divergência entre estado otimista e transação do servidor.
- **Regras do Firestore mais estritas**: o modelo com `memberIds`/`activeMemberIds` permite validar entrada, aprovação, despesas e remoção sem iterar objetos de membro.
- **Qualidade mínima ativa**: `npx tsc --noEmit` e `npm run lint` passam no estado atual.

### O que precisa amadurecer

- **Testes e CI**: não há testes automatizados nem pipeline. As funções puras (`currency`, `date`, `number`, `splitLogic`, `memberLogic`, `OperationQueue`) são altamente testáveis e concentram o maior risco de regressão.
- **Privacidade e loja**: não existe arquivo de política de privacidade no repositório; a publicação e a declaração de dados do app dependem de processo externo não documentado.
- **Identidade**: a autenticação é anônima e o UID é persistido localmente. Desinstalar ou limpar dados pode perder o acesso a grupos existentes; não há vinculação de conta nem transferência de propriedade.
- **Operações permanentemente falhas**: a fila tem backoff e mantém a ordem, mas não há dead-letter, painel de inspeção ou ação de descarte para uma operação que nunca será aceita.
- **Documentação**: o README ainda afirma que não há lint, embora o ESLint exista e passe; as regras do Firestore são publicadas manualmente.
- **i18n e acabamento**: há strings em inglês fixas no código e uso de `alert()` global em pontos isolados.

---

## Estratégias que funcionaram

### 1. Aplicar localmente, enfileirar e reaplicar

Fluxo observado em `context/GroupContext.tsx` e `services/OperationProcessor.ts`:

1. A mutação é aplicada ao grupo local e salva em `LocalGroupStore`.
2. O grupo é marcado como pendente em `pendingGroups` antes da escrita assíncrona.
3. Uma operação é enfileirada com ID determinístico quando a idempotência importa (ex.: `create-${groupId}`, `join-${groupId}-${userId}`).
4. `processQueue()` tenta drenar a fila imediatamente e em eventos de conectividade, retorno ao foreground e a cada 30 s.
5. O processador agrupa por `groupId`, respeita FIFO e interrompe o grupo no primeiro erro, preservando dependências como `createGroup → addExpense`.

**Por que funcionou:** a UI responde sem rede, e a ordem por grupo evita que uma despesa chegue antes da criação do grupo.

### 2. Idempotência em ambos os lados

- No cliente, IDs de operação e de entidade são reaproveitados em retries.
- No servidor, `addExpense` e `addMember` fazem `runTransaction`, leem o documento e retornam sem alteração se o ID já existir.
- As regras permitem `isNoOpRetry` quando apenas `updatedAt` muda.

**Efeito:** reenvios após falha de rede não duplicam despesas ou membros.

### 3. Fonte local primeiro, servidor como convergência

`getGroup` lê `LocalGroupStore` antes do Firestore; `subscribeToGroup` usa um único listener por grupo e mantém a cópia local enquanto há operações pendentes. Snapshot do servidor não sobrescreve mudanças otimistas pendentes.

### 4. Derived state em vez de estado duplicado

Saldos e transações são recalculados com `useMemo` a partir de `currentGroup` em `app/group/[id].tsx`. Isso eliminou a necessidade de sincronizar arrays de saldo em `useEffect`, reduzindo renders e estados inconsistentes.

### 5. Regras puras compartilhadas

`utils/memberLogic.ts` concentra:

- derivação de IDs;
- normalização de nomes (case e acentos);
- prioridade de conflito (dono > conta real > pedido pendente > virtual única > ambíguo);
- aprovação com merge de membro virtual;
- remoção e merge de referências financeiras.

O mesmo módulo é importado por `FirebaseService` e `MockService`, o que torna o comportamento local e servidor previsível.

### 6. Não destrutividade em sincronização

- `mergeLocalSnapshot` só adiciona membros/despesas e atualiza campos de grupo; nunca remove dados do servidor.
- `getGroup` lança erro em cache miss offline em vez de retornar `null`.
- `subscribeToGroup` só considera exclusão quando o snapshot não vem do cache e não tem escrita pendente.

---

## Erros cometidos e prevenções

| Erro / sintoma | Correção aplicada | Prevenção | Lição |
|---|---|---|---|
| Reconciliação de snapshot inteiro podia apagar dados locais com base em cópia velha | Outbox durável com operações incrementais e merge não destrutivo (`052385c`, `eee4089`) | Tratar sincronização como conjunto de intenções, não como substituição de documento | L-001, L-022 |
| Cache miss era interpretado como grupo excluído | `getGroup` lança erro quando `fromCache`; listener só remove em exclusão confirmada pelo servidor (`58802ff`) | Separar “não encontrado no cache” de “não existe no servidor” | L-004 |
| Assinaturas vazavam em `joinGroup` | Remoção de listeners e centralização em `subscribeToGroup` (`649cbac`) | Um único listener por grupo, com contagem de consumidores e unsubscribe no último | L-013 |
| Toque duplo criava despesa/membro duplicado | Flags `savingExpenseRef`/`savingMemberRef` e bloqueio de reentrada (`23c9a73`) | Guardar submissão em `ref` sincronamente, além do estado visual | L-020 |
| Data da despesa mudava de dia por UTC | `dateString` local `YYYY-MM-DD`; parsing ao meio-dia local (`1f7eadc`) | Nunca usar `toISOString()` para data de calendário exibida | L-006 |
| Valores como `1.234,56` e `1,234.56` eram interpretados errado | `parseAmountToMinor` com último separador como decimal e arredondamento half-up (`f42eef1`) | Parsear direto para unidades menores; validar em vez de truncar | L-007 |
| Imagem quebrava rota quando `expo-image-manipulator` não estava no binário | Import dinâmico com fallback para o base64 do picker (`3b98663`) | Módulos nativos opcionais devem falhar de forma degradada | L-010 |
| Recompensa de anúncio era concedida ao fechar, não ao concluir | Reward somente em `EARNED_REWARD`; timers limpos no unmount (`882971d`) | Modelar o evento de negócio correto, não o evento de UI mais próximo | L-015 |
| Share sheet cobria o aviso de ID copiado | Aviso renderizado antes, share adiado com `requestAnimationFrame` (`882971d`) | Separar feedback visual de ação nativa e aguardar o frame de pintura | L-018 |
| Status de sync abria um listener extra por grupo | Status derivado de `onSnapshot` existente e metadata (`93d5099`) | Reutilizar streams já abertos antes de criar novos | L-005 |
| Settlement era reconhecido apenas pelo título traduzido | Campo `settlement` explícito em novas despesas, com fallback por título (`93d5099`) | Persistir semântica, não texto de apresentação | L-017 |
| Havia lint configurado? Não; a qualidade dependia de revisão manual | ESLint + `eslint-config-expo` e script `lint` (`93d5099`) | Todo projeto deve nascer com lint e typecheck executáveis | L-023 |
| Cópia local permanecia após perda de membership | Grupos são removidos localmente quando o UID não está em `memberIds`/`ownerId`, salvo operações pendentes (`93d5099`) | Revalidar membership em refresh e em snapshots | L-012 |

> Todos os itens acima estão **corrigidos** no código atual. Eles permanecem como prevenção, não como pendência.

---

## Funcionalidades reutilizáveis

### Outbox offline (`services/OperationQueue.ts` + `services/OperationProcessor.ts`)

- Fila persistida em `AsyncStorage` com `OperationType` fechado.
- Serialização de escritas com `queueLock`.
- Coalescência de `updateGroup` por ID, preservando a posição original.
- Retry com backoff exponencial de até 60 s.
- Processamento FIFO por grupo e continuidade entre grupos.

**Reuso:** serve para qualquer app com Firestore e necessidade de mutações offline. É preciso adaptar o `switch` de operações e a política de conflito.

### Regras de membros (`utils/memberLogic.ts`)

- `deriveMemberIds`, `withMemberIds`, `normalizeGroupMemberIds`.
- `findNameConflict` com normalização de acentos e prioridade.
- `prepareMemberApproval`, `applyMemberApproval`, `applyMemberMerge`, `applyMemberRemoval`.

**Reuso:** modelos de grupo com participantes, convidados e “membros manuais” que depois criam conta.

### Dinheiro (`utils/currency.ts` + `utils/number.ts`)

- Lista ISO 4217 estática, sem depender de `Intl.supportedValuesOf`.
- `normalizeCurrency`, `getCurrencyFractionDigits`, `toMinorUnits`, `fromMinorUnits`.
- `parseAmountToMinor` com separadores localizados e arredondamento half-up.
- Formatação com `Intl.NumberFormat` e fallback.

**Reuso:** qualquer app que aceite entrada `1.234,56` e `1,234.56`, inclusive moedas sem centavos (JPY).

### Datas (`utils/date.ts`)

- `toDateInputValue`, `isValidDateInput`, `parseDateInput` ao meio-dia local.
- `dateStringFromTimestamp` para legado UTC.
- `expenseDateString` com preferência por `dateString`.
- `formatDateString` sem deslocamento.

**Reuso:** despesas, recibos e eventos que pertencem a um dia civil, não a um instante.

### Configuração remota e anúncios

- `ConfigService` busca `appconfig.json` em `EXPO_PUBLIC_BASE_URL`.
- `ConfigContext` aplica fallback (`launched`/`updated`) e `realAds: false`.
- `useRewardedAd` usa ID de teste por padrão e só usa ID real quando `realAds && !loading`.
- `useRewardedAd.web.ts` evita importar AdMob na web.
- `requestNonPersonalizedAdsOnly: true` reduz personalização.

### Componentes de apresentação

- `ScreenWrapper`: gradiente, safe area e barra de navegação.
- `CurrencyPicker`: `SectionList` com busca, seções “principais” e “outras”.
- `SyncIndicator`: badge/ícone/texto para `synced`, `pending`, `offline`.
- `ErrorBoundary`: fallback amigável com retry e log central.

---

## Arquitetura observada

### Camadas

```
app/ (Expo Router)
  └─ consome GroupContext / ConfigContext
       ├─ GroupContext
       │    ├─ LocalGroupStore (AsyncStorage: local_groups, dirty_groups)
       │    ├─ OperationQueue (AsyncStorage: pending_group_operations)
       │    ├─ OperationProcessor
       │    └─ StorageService
       │         ├─ FirebaseService (produção)
       │         └─ MockService (USE_MOCK=false)
       ├─ ConfigContext → ConfigService (HTTP appconfig.json)
       └─ i18n/translations.ts (AsyncStorage: app_locale)
```

### Leitura de grupo

1. `getGroup` tenta `LocalGroupStore`.
2. Se não houver cópia, busca no Firestore, normaliza IDs e salva localmente.
3. A tela assina `subscribeToGroup`, que mantém um único `onSnapshot` por `groupId`.
4. Snapshot com operações pendentes não sobrescreve a cópia local.
5. Grupo removido da membership é apagado localmente, exceto se houver operação pendente.

### Escrita de grupo

1. Contexto atualiza o objeto `Group` em memória e em `LocalGroupStore`.
2. Operação é enfileirada com `groupId`, tipo e payload.
3. `OperationProcessor` aplica via `StorageService`.
4. Transações do Firestore validam existência, deduplicam IDs e recalculam `memberIds`.
5. Sucesso remove a operação; falha incrementa `attempts` e agenda novo retry.

### Autenticação

- `firebaseConfig.ts` inicializa Firebase, Firestore com cache persistente e long polling, e Auth com persistência em `AsyncStorage`.
- `GroupContext` restaura `uid` local, escuta `onAuthStateChanged` e faz `signInAnonymously` quando necessário.
- O UID é gravado em `AsyncStorage` (`uid`).

### Modelo de segurança

- `get` de grupo é permitido a qualquer usuário autenticado que conheça o ID.
- `list` é limitado às queries de descoberta (`ownerId` ou `memberIds`) e `limit <= 100`.
- Owner gerencia membros, moeda, nome e imagem.
- Membro ativo pode adicionar membro virtual/pendente e despesa criada por ele mesmo.
- Despesa só referencia membros ativos.
- `memberIds`/`activeMemberIds` são validados por tamanho, unicidade, subconjunto e presença do owner.

### Observações arquiteturais

- O app usa um `GroupContext` central; as telas não falam diretamente com o Firestore para mutações.
- `MockService` existe, mas está desativado por `USE_MOCK = false`.
- O schema é orientado a documento único por grupo, com arrays de membros e despesas.
- O histórico recente mostra migração gradual de um modelo “snapshot completo” para “operações incrementais”.

---

## Qualidade, testes e CI

### Estado atual verificado

| Verificação | Comando | Resultado |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | saída 0 |
| Lint | `npm run lint` | saída 0 |
| Testes unitários | — | nenhum arquivo de teste e nenhum runner configurado |
| CI | — | nenhum workflow no repositório |
| Script de typecheck | — | não existe em `package.json` |
| Script de teste | — | não existe em `package.json` |

`package.json` expõe apenas `start`, `android`, `ios`, `web` e `lint`. O `tsconfig.json` estende `expo/tsconfig.base` com `strict: true`.

### Cobertura conceitual que falta

Prioridade alta, por serem funções puras e centrais:

- `utils/currency.ts` e `utils/number.ts`: separadores, moedas com 0/2/3 casas, arredondamento.
- `utils/date.ts`: ano bissexto, DST, `YYYY-MM-DD`, legado UTC.
- `utils/splitLogic.ts`: resto distribuído, membros inativos, referências órfãs, settlements.
- `utils/memberLogic.ts`: conflito de nomes, virtual única, ambígua, merge, remoção.
- `services/OperationQueue.ts`: FIFO, coalescência, lock, retry/backoff.
- Regras do Firestore: testes com o emulador para self-join, aprovação, despesa e no-op retry.

### Práticas que já ajudam

- TypeScript `strict`.
- ESLint com `eslint-config-expo`.
- Funções puras isoladas em `utils/`, sem dependência de React.
- Logs centralizados e desativados em produção para `debug`/`info`.
- Comentários de decisão no código explicando armadilhas (cache, datas, imagens, listeners).

---

## Checklist para um novo app

1. **Definir a fonte de verdade offline** antes da UI: armazenamento local, fila de operações e política de conflito.
2. **Modelar valores monetários em unidades menores** e criar parser único para entrada localizada.
3. **Separar data de calendário de timestamp**; persistir `YYYY-MM-DD` para exibição.
4. **Criar um único ponto de mutação** (contexto/serviço) e não espalhar chamadas ao backend pelas telas.
5. **Implementar idempotência** com IDs determinísticos e transações no servidor.
6. **Projetar as regras de segurança junto com o schema**, incluindo arrays derivados quando a linguagem de regras não itera listas.
7. **Tratar cache miss, offline e “não encontrado” como estados distintos**.
8. **Centralizar regras de domínio** que precisam ser iguais no cliente e no servidor.
9. **Adicionar lint + typecheck desde o início** e um script explícito no `package.json`.
10. **Criar testes para funções puras** antes de aumentar a complexidade da UI.
11. **Configurar CI** para instalar dependências, rodar lint, typecheck e testes.
12. **Documentar privacidade, retenção e tratamento de dados** antes da publicação.
13. **Definir estratégia de identidade** (anônima, linkável, recuperável) antes de permitir grupos importantes.
14. **Tratar mídia como opcional e degradável** quando depender de módulo nativo.
15. **Versionar regras e configuração de build** (`firebase.json`, perfis EAS) para evitar publicação manual.

---

## Itens específicos do projeto

### Identidade e grupos

- O UID anônimo é a chave de propriedade e membership. Não há login social, e-mail ou recuperação.
- O ID do grupo é gerado aleatoriamente no cliente e funciona como segredo de convite.
- O owner é sempre `members[0]` e não pode ser removido nem mesclado.
- A remoção de membro apaga despesas pagas por ele e retira seu ID de `splitAmong`; despesas sem participantes são removidas.
- A aprovação de um pedido pode “assumir” um único membro virtual de mesmo nome, transferindo histórico.
- Nomes são comparados sem diferenciar caixa ou acentos; o nome do owner é reservado.

### Moeda e valores

- Uma moeda por grupo; o owner pode alterar, mas não há conversão de valores.
- A moeda é escolhida na criação; grupos legados sem moeda exibem aviso e bloqueiam despesas até o owner definir.
- A formatação usa o locale do app e a moeda do grupo, de forma independente.
- `FEATURED_CURRENCIES` prioriza BRL, USD, EUR, JPY, GBP e CNY; as demais ficam em “outras”.

### Despesas e settlements

- Despesas guardam `date` (timestamp de ordenação/legado) e `dateString` (exibição).
- Settlement é uma despesa com `settlement: true`, título traduzido e um único participante.
- Settlements antigos sem flag são reconhecidos por `Settlement`, `Quitação` ou `Quitación`.
- O total de despesas exclui settlements.
- O botão de deletar despesa aparece para o criador ou owner; a regra do Firestore aplica a mesma condição.

### Imagem do grupo

- Não usa Firebase Storage.
- A imagem é redimensionada para 96 px de largura, comprimida em JPEG e salva como data URI base64 no documento do grupo.
- O limite de novos data URIs é 200.000 caracteres; imagens legadas maiores são sinalizadas e continuam gerenciáveis.
- `expo-image-manipulator` é importado dinamicamente; se indisponível, usa o base64 do picker.

### Anúncios e doações

- `ConfigService` busca configuração remota; `realAds` é `false` por padrão.
- Sem `realAds`, o app usa o ID de teste do Google.
- A seção de anúncio na tela de doação só aparece com `realAds`.
- A recompensa só é marcada em `EARNED_REWARD`.
- Na web, o hook de anúncio é um stub.

### Internacionalização

- Locales suportados: `en`, `es`, `pt`.
- O locale é restaurado de `AsyncStorage` (`app_locale`), com fallback para o idioma do dispositivo e depois `en`.
- `i18n.enableFallback = true`.
- A troca de idioma é feita na tela inicial.

### Convite e deep link

- Scheme `mysplit`.
- O handler em `app/_layout.tsx` reconhece `mysplit://join?groupId=...` e navega para `/?joinGroupId=...`.
- A tela inicial preenche a aba “Join” e o ID.
- O compartilhamento copia o ID para o clipboard e abre o share sheet com instruções.

### Build e distribuição

- `app.config.ts`: Android package `com.mabesi.mysplit`, versionCode `2`, iOS com tablet, splash e AdMob.
- `eas.json`: `development` com dev client e `autoIncrement`; `preview` gera APK; `production` gera AAB e `autoIncrement`.
- `appVersionSource: "remote"`.
- `android/` e `ios/` são gerados localmente e ignorados pelo Git.

---

## Última rodada de endurecimento

### Mudanças recentes (commits `882971d` e `93d5099`)

| Mudança | Decisão | Efeito verificado | Status |
|---|---|---|---|
| Status de sync passou a usar metadata do `onSnapshot` já aberto | Evitar um listener extra por grupo | `useSyncStatus` lê `GroupContext`; um único stream por grupo alimenta status e dados | corrigido |
| Settlement ganhou campo booleano explícito | Não depender do título traduzido | `addExpense` grava `settlement`; leitura mantém fallback para títulos legados | corrigido |
| `ErrorBoundary` no root layout | Evitar tela branca em erro de render | Fallback com ícone, mensagem traduzida e botão “tentar novamente”; erro vai ao logger | corrigido |
| ESLint adicionado | Criar gate local de qualidade | `npm run lint` existe e passa; `eslint.config.js` ignora `dist`, `android`, `ios`, `.expo` | corrigido |
| Grupos sem membership são removidos localmente | Não manter cópia de grupo do qual o usuário saiu | Refresh e snapshot checam `ownerId`/`memberIds`, preservando operações pendentes | corrigido |
| Saldos memoizados | Evitar `useEffect` + estado derivado | `calculateBalances` roda em `useMemo` sobre `currentGroup` | corrigido |
| Abertura do modal de despesa centralizada | Garantir `splitAmong` atualizado | `openAddExpense` define participantes ativos antes de abrir | corrigido |
| Assinaturas de grupo com contagem de consumidores | Evitar listener duplicado/leak | `groupListeners` + `groupUnsubscribers`; último unsubscribe fecha o backend | corrigido |
| Aviso de compartilhamento antes do share sheet | Evitar que a sheet cubra o aviso | Aviso renderizado e share adiado por `requestAnimationFrame` | corrigido |
| Recompensa de anúncio apenas em `EARNED_REWARD` | Não premiar fechamento antecipado | `rewardReceived` só muda no evento correto; timers são limpos | corrigido |
| Preservação de grupos criados durante validação | Evitar corrida no refresh | `refreshMyGroups` relê o store local ao final e faz união | corrigido |
| Erro offline distinto de grupo inexistente | Evitar mensagem errada no join | `getGroup` propaga erro de cache; UI separa `group_not_found` de `error` | corrigido |
| Prevenção de submissão dupla | Evitar duplicidade | `savingExpenseRef`/`savingMemberRef` bloqueiam reentrada | corrigido |
| Imagem sem módulo nativo | Não quebrar a rota | Import dinâmico com fallback para base64 do picker | corrigido |

### Decisões e trade-offs

- **Status de sync derivado**: menos listeners e menor custo, mas o status depende de o grupo ter assinatura aberta. `getSyncStatus` retorna `synced` como padrão quando não há status registrado.
- **Exclusão local por membership**: reduz dados obsoletos, mas exige cuidado com operações pendentes para não apagar um join em andamento.
- **Leitura por ID aberta a autenticados**: permite convite simples por ID, mas significa que o ID é o segredo. A regra documenta explicitamente esse trade-off.
- **Settlement como despesa**: reutiliza o modelo e o cálculo existente, com a flag para separar do total. Mantém compatibilidade com dados antigos por título.
- **Miniatura em Firestore**: evita Storage e custo adicional, mas limita qualidade e tamanho da imagem.

### Pendências desta rodada

- Criar testes de regressão para status de sync, settlement legado e remoção por perda de membership.
- Atualizar o README: a seção “Known Limitations” ainda diz que não há lint, mas o lint existe e passa.
- Adicionar script `typecheck` e executá-lo no CI junto com lint e testes.
- Definir política para operações que falham permanentemente (dead-letter ou ação de descarte).
- Revisar strings fixas em inglês e o uso de `alert()` global em `GroupContext.removeMember`.

---

## Perguntas para consolidação multi-projeto

1. Qual é a **fonte de verdade offline** e como mutações pendentes são reconciliadas com o servidor?
2. O modelo de identidade é recuperável? O que acontece ao desinstalar, trocar de dispositivo ou limpar dados?
3. O backend aceita **retries idempotentes**? Como duplicatas são detectadas?
4. As regras de segurança foram projetadas junto com o schema ou adaptadas depois?
5. Como o app distingue **offline**, **cache miss** e **recurso inexistente**?
6. Valores monetários são tratados em unidades menores? Como o resto da divisão é distribuído?
7. Datas de calendário são persistidas como data ou como timestamp? Qual é o comportamento em DST?
8. Mídia é armazenada no banco, em object storage ou apenas referenciada? Qual é o limite e o fallback?
9. Funcionalidades opcionais (ads, câmera, manipulação de imagem) degradam sem quebrar a navegação?
10. Existem lint, typecheck, testes e CI? Quais são executáveis localmente com um comando?
11. Privacidade, retenção e exclusão de dados estão documentadas e refletidas na loja?
12. Regras, configuração de build e variáveis de ambiente estão versionadas ou dependem de passos manuais?

---

## Anexos

### A. Modelo de dados

`Group` (`types/index.ts`):

| Campo | Tipo | Observação |
|---|---|---|
| `id` | `string` | ID do documento; também é o segredo de convite. |
| `name` | `string` | Nome do grupo. |
| `currency?` | `string` | ISO 4217; uma por grupo. |
| `imageUrl?` | `string` | Data URI base64 ou URL legada. |
| `ownerId` | `string` | UID do criador. |
| `createdAt` / `updatedAt` | `number` | Timestamps. |
| `version` | `number` | Versão do schema/optimistic concurrency. |
| `members` | `Member[]` | Owner em `members[0]`. |
| `expenses` | `Expense[]` | Array no documento do grupo. |
| `memberIds` | `string[]` | Derivado de `members`; usado pelas regras. |
| `activeMemberIds` | `string[]` | Derivado de membros não pendentes. |

`Member`:

| Campo | Tipo | Observação |
|---|---|---|
| `id` | `string` | UID real ou `user-*` para membro manual. |
| `name` | `string` | Nome exibido. |
| `email?` | `string` | Opcional. |
| `avatarUrl?` | `string` | Opcional. |
| `status?` | `'active' \| 'pending'` | Ausente equivale a ativo. |
| `virtual?` | `boolean` | Membro manual que pode ser assumido. |

`Expense`:

| Campo | Tipo | Observação |
|---|---|---|
| `id` | `string` | ID da despesa. |
| `title` | `string` | Título; settlement legado usa título traduzido. |
| `amount` | `number` | Valor na moeda do grupo. |
| `paidBy` | `string` | ID do membro pagador. |
| `splitAmong` | `string[]` | IDs dos participantes. |
| `date` | `number` | Timestamp de ordenação/legado. |
| `dateString?` | `string` | `YYYY-MM-DD` para exibição. |
| `settlement?` | `boolean` | Marcador explícito de quitação. |
| `createdBy` | `string` | ID do membro criador. |
| `createdAt` | `number` | Timestamp de criação. |

### B. Tipos de operação da outbox

`createGroup`, `mergeGroup`, `addMember`, `removeMember`, `updateMemberStatus`, `addExpense`, `deleteExpense`, `updateGroup`, `deleteGroup`.

Campos de `QueuedOperation`: `id`, `groupId`, `type`, `payload`, `createdAt`, `attempts`, `lastAttemptAt?`, `lastError?`.

### C. Resumo das regras do Firestore

- `get`: qualquer usuário autenticado que conheça o ID.
- `list`: somente queries de descoberta com `limit <= 100`, restritas a `ownerId` ou `memberIds`.
- `create`: owner como único membro inicial, `version == 1`, `memberIds == [uid]`, `activeMemberIds == [uid]`, moeda válida.
- `update`: uma das branches — gestão de membros pelo owner, resumo (nome/imagem), moeda, self-join pendente, append de membro, adicionar despesa, remover despesa ou no-op retry.
- `delete`: somente owner.
- Limites: até 100 membros, até 5000 despesas, imagem nova até 200.000 caracteres, valor de despesa `> 0` e `< 1.000.000.000`.

### D. Comandos verificados

```bash
npm install
npm start                 # Metro
npm run android           # dev client Android
npm run ios               # dev client iOS (macOS)
npm run web               # versão web
npm run lint              # ESLint
npx tsc --noEmit          # typecheck (script não existe no package.json)
npx expo start --dev-client
npx expo start -c         # limpar cache do Metro
npx eas build --platform android --profile preview
npx eas build --platform android --profile production
```

Publicação das regras: não há `firebase.json`/`.firebaserc`; o README orienta colar `firestore.rules` no Console do Firebase. Também é possível adicionar a configuração e usar `firebase deploy --only firestore:rules`.

### E. Estrutura observada

```
.
├── app/                      # Expo Router
│   ├── index.tsx             # home, criação/entrada em grupo
│   ├── group/[id].tsx        # despesas, saldos, settlements
│   ├── group/members.tsx     # aprovação, remoção, membros
│   ├── group/settings.tsx    # imagem, moeda, compartilhamento
│   ├── help.tsx
│   ├── donate.tsx
│   └── _layout.tsx           # providers, deep link, splash, ads
├── components/               # ScreenWrapper, CurrencyPicker, SyncIndicator, ErrorBoundary
├── context/                  # GroupContext, ConfigContext
├── services/                 # Firebase, Mock, LocalStore, Queue, Processor, Config
├── hooks/                    # useSyncStatus, useRewardedAd(.web)
├── utils/                    # currency, date, number, memberLogic, splitLogic, logger, sync
├── i18n/                     # en, es, pt
├── types/                    # Group, Member, Expense
├── firestore.rules
├── app.config.ts
├── eas.json
├── eslint.config.js
├── tsconfig.json
├── package.json
└── README.md
```

### F. Variáveis de ambiente (nomes apenas)

Obrigatórias para Firebase:

`EXPO_PUBLIC_FIREBASE_API_KEY`, `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`, `EXPO_PUBLIC_FIREBASE_PROJECT_ID`, `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`, `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `EXPO_PUBLIC_FIREBASE_APP_ID`, `EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID`.

Opcionais:

`EXPO_PUBLIC_BASE_URL`, `EXPO_PUBLIC_CONFIG_URL`, `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID`, `EXPO_PUBLIC_ADMOB_IOS_APP_ID`, `EXPO_PUBLIC_ADMOB_REWARDED_ID`.

Observação verificada: `EXPO_PUBLIC_CONFIG_URL` está documentada no README, mas `ConfigService` monta a URL a partir de `EXPO_PUBLIC_BASE_URL` e não lê essa variável.

### G. Dívidas e riscos catalogados

| ID | Dívida/risco | Evidência | Impacto |
|---|---|---|---|
| L-023 | Sem testes, CI ou script de typecheck | `package.json`; ausência de arquivos de teste e `.github/` | Regressões silenciosas em dinheiro, datas, fila e regras. |
| L-024 | Sem política de privacidade no repositório | busca por `privac*` não encontrou arquivo | Risco de conformidade e de publicação na loja. |
| L-025 | Regras publicadas manualmente | ausência de `firebase.json`/`.firebaserc`; README | Ambiente pode divergir do repositório. |
| L-026 | Strings fixas em inglês e `alert()` global | `app/group/[id].tsx` (“No members yet”, “Creating...”); `GroupContext.removeMember` | Inconsistência de idioma e de UX. |
| L-027 | `EXPO_PUBLIC_CONFIG_URL` não usada; README desatualizado sobre lint | `services/ConfigService.ts`; `README.md` linha 266 | Configuração confusa; documentação enganosa. |
| L-029 | Script `manage_secrets.sh` contém valores de projeto e está fora do Git | `.gitignore`; arquivo local | Risco de vazamento ao copiar o projeto ou o script. |
| — | `MockService.addExpense` sobrescreve `createdAt` com `Date.now()` | `services/MockService.ts` | Baixo em produção (`USE_MOCK = false`), mas engana testes futuros. |
| — | Sem dead-letter para operação permanentemente rejeitada | `services/OperationProcessor.ts` | Fila pode ficar bloqueada por grupo até intervenção. |

---

## Próximos passos

### P0 — antes de considerar o app “endurecido”

1. Criar testes unitários para `currency`, `number`, `date`, `splitLogic`, `memberLogic` e `OperationQueue`.
2. Configurar CI para `npm ci`, `npm run lint`, `npx tsc --noEmit` e testes.
3. Adicionar script `typecheck` ao `package.json`.
4. Criar e publicar política de privacidade; revisar declaração de dados da loja.
5. Definir e documentar estratégia de identidade/recuperação de grupos.

### P1 — reduzir risco operacional

6. Adicionar `firebase.json`/`.firebaserc` e versionar a publicação das regras.
7. Criar dead-letter ou tela de diagnóstico para operações falhas.
8. Atualizar o README (lint existente, limitações atuais, estado de testes/CI).
9. Remover ou usar `EXPO_PUBLIC_CONFIG_URL`; alinhar documentação e código.
10. Revisar strings hardcoded e substituir `alert()` global por `Alert.alert` com i18n.
11. Documentar rotação/gestão de segredos e remover valores de projeto de scripts locais.

### P2 — evolução

12. Integrar crash reporting ao `logger` (o `ErrorBoundary` já concentra os erros de render).
13. Avaliar limites de escala do documento único (5000 despesas) e estratégia de paginação/arquivamento.
14. Adicionar testes de regras com o emulador do Firestore.
15. Avaliar transferência de propriedade e vinculação de conta anônima.
16. Revisar performance de listas grandes e do cálculo de saldos.

---

## Anexo H. Histórico recente relevante

| Commit | Tema | Lição associada |
|---|---|---|
| `93d5099` | Sync compartilhado, settlement explícito, ErrorBoundary, ESLint | L-005, L-014, L-017, L-023 |
| `882971d` | Carregamento de grupo, offline, aviso de share, reward de anúncio | L-004, L-015, L-018, L-020 |
| `7cf0b5f` | Persistência de idioma e logs de debug | L-026 |
| `649cbac` | Remoção de assinaturas vazadas em `joinGroup` | L-013 |
| `23c9a73` | Prevenção de despesa/membro duplicado | L-020 |
| `3b98663` | Fallback de miniatura sem módulo nativo | L-010 |
| `093c878` | Miniatura pequena em vez de imagem completa | L-010 |
| `7955402` | Uma moeda por grupo | L-008 |
| `1f7eadc` | Datas como calendário local | L-006 |
| `f42eef1` | Parsing monetário localizado | L-007 |
| `d971c89` | Descoberta de grupos ausentes | L-016 |
| `58802ff` | Cache miss não é exclusão | L-004 |
| `595c9d7` | Arrays de IDs para regras estritas | L-003 |
| `052385c` | Outbox durável | L-001 |
| `eee4089` | Sincronização não destrutiva | L-022 |

---

*Documento de lições aprendidas. Nenhum código de produção foi alterado. Sem commit ou push.*
