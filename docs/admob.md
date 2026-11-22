# AdMob no MySplit — esquema atual

Este documento descreve **o que está implementado hoje** no projeto para Google Mobile Ads (AdMob). Ele cobre arquivos, fluxo de execução, variáveis, IDs, configuração remota, comportamento dos botões, bloqueios de exibição, testes e limitações conhecidas.

> Escopo: anúncio recompensado (rewarded) na tela de doação. Não há banner, interstitial, native ad ou anúncio forçado no código atual.

---

## 1. Visão geral

| Item | Estado atual |
|---|---|
| Formato de anúncio | **Rewarded** (`RewardedAd`) |
| Tela que exibe | `app/donate.tsx` |
| Entrada para a tela | Botão “Donate” na home (`app/index.tsx`) |
| SDK | `react-native-google-mobile-ads` `^17.4.0` |
| Inicialização | `app/_layout.tsx`, no mount do layout raiz |
| Configuração de ativação | `realAds` vindo de `appconfig.json` remoto |
| Fallback de IDs | IDs oficiais de teste do Google |
| Personalização | `requestNonPersonalizedAdsOnly: true` |
| Web | Stub em `hooks/useRewardedAd.web.ts`; não carrega anúncio |
| Consentimento UMP/ATT | Não implementado |
| Verificação server-side da recompensa | Não implementada; a “recompensa” é apenas uma mensagem de agradecimento local |
| Frequência/limite | Sem limite; o usuário pode assistir novamente após o anúncio fechar |

---

## 2. Estrutura de arquivos

```
.
├── app.config.ts                  # Plugin do AdMob e App IDs (Android/iOS)
├── app/
│   ├── _layout.tsx                # Inicializa o SDK nativo uma vez
│   ├── index.tsx                  # Botão "Donate" que abre /donate
│   └── donate.tsx                 # Tela de doação + botão de anúncio
├── context/
│   └── ConfigContext.tsx          # Provider de configuração remota (realAds)
├── services/
│   └── ConfigService.ts           # Busca appconfig.json
├── hooks/
│   ├── useRewardedAd.ts           # Implementação nativa do rewarded
│   └── useRewardedAd.web.ts       # Stub para web
├── i18n/
│   └── translations.ts            # Textos de doação/anúncio (en, es, pt)
├── package.json                   # Dependência do SDK
├── .env                           # IDs locais (git-ignored)
├── manage_secrets.sh              # Sincroniza IDs com EAS Secrets (git-ignored)
└── android/                       # Gerado; contém o APPLICATION_ID no manifesto
```

### Responsabilidade de cada arquivo

| Arquivo | Responsabilidade |
|---|---|
| `app.config.ts` | Declara o plugin `react-native-google-mobile-ads` e injeta `androidAppId`/`iosAppId` no projeto nativo. |
| `app/_layout.tsx` | Carrega o módulo nativo com `require` protegido por `try/catch`, ignora web e chama `mobileAds().initialize()`. |
| `context/ConfigContext.tsx` | Mantém `realAds`, `launched`, `updated` e `loading`; começa com `realAds: false`. |
| `services/ConfigService.ts` | Faz `fetch` de `${EXPO_PUBLIC_BASE_URL}/appconfig.json` e retorna `data.mysplit`. |
| `hooks/useRewardedAd.ts` | Cria o `RewardedAd`, escolhe o ad unit ID, carrega, escuta eventos e expõe `loaded`, `rewardReceived`, `showAd`, `error`, `resetReward`. |
| `hooks/useRewardedAd.web.ts` | Substitui o hook na web via resolução de plataforma do Metro; retorna `loaded: false` e um `showAd` que apenas loga aviso. |
| `app/donate.tsx` | Renderiza doação e, se `realAds`, o bloco “ou” + botão de anúncio; dispara alerta de agradecimento ao receber recompensa. |
| `app/index.tsx` | Botão “Donate” que navega para `/donate`, independentemente de `realAds`. |
| `i18n/translations.ts` | Chaves `supportDev`, `donationMsg`, `donate`, `or`, `watchAd`, `loadingAd`, `adThankYou`, `success`. |
| `manage_secrets.sh` | Cria/atualiza os secrets de projeto no EAS com `eas secret:create`. |

---

## 3. Fluxo em runtime

```
App inicia
  │
  ├─ RootLayout
  │    ├─ require('react-native-google-mobile-ads') (não-web, try/catch)
  │    └─ mobileAds().initialize()
  │
  ├─ ConfigProvider
  │    ├─ realAds = false (default)
  │    ├─ loading = true
  │    └─ fetch(EXPO_PUBLIC_BASE_URL + '/appconfig.json')
  │         ├─ sucesso → aplica data.mysplit → loading = false
  │         └─ falha   → mantém default  → loading = false
  │
  └─ Usuário toca "Donate" na home
       └─ /donate
            ├─ Botão de doação sempre visível
            ├─ useRewardedAd() é chamado sempre
            │    ├─ adUnitId = realAds && !loading
            │    │    ? EXPO_PUBLIC_ADMOB_REWARDED_ID || TEST_AD_ID
            │    │    : TEST_AD_ID
            │    ├─ cria RewardedAd com requestNonPersonalizedAdsOnly
            │    ├─ load() após 1 s
            │    └─ escuta LOADED / EARNED_REWARD / CLOSED / ERROR
            └─ Bloco de anúncio só é renderizado se realAds
                 ├─ botão desabilitado enquanto !loaded
                 ├─ ao tocar com loaded → showAd()
                 └─ EARNED_REWARD → alerta de agradecimento
```

### Ponto importante

`useRewardedAd()` é chamado **incondicionalmente** dentro de `DonateScreen`, mesmo quando `realAds` é `false`. Nesse caso o botão não aparece, mas o hook ainda cria e carrega um anúncio de **teste** quando a tela de doação é aberta. O SDK é inicializado uma vez no layout raiz; a solicitação do rewarded acontece ao montar `/donate`.

---

## 4. IDs: App ID x Ad Unit ID

O projeto usa dois tipos de identificador. Eles não são intercambiáveis:

| Tipo | Formato | Onde é usado | Exemplo de teste |
|---|---|---|---|
| App ID | `ca-app-pub-...~...` | Plugin do `app.config.ts`; vira `APPLICATION_ID` no Android e `GADApplicationIdentifier` no iOS | `ca-app-pub-3940256099942544~3347511713` (Android) |
| Ad Unit ID | `ca-app-pub-.../...` | `RewardedAd.createForAdRequest(...)` | `ca-app-pub-3940256099942544/5224354917` |

- O **App ID** identifica o aplicativo no AdMob e é necessário para o SDK inicializar.
- O **Ad Unit ID** identifica o bloco de anúncio que será solicitado.
- O App ID é lido em **build time** pelo plugin do Expo.
- O Ad Unit ID é lido em **bundle time** pelo Metro via `EXPO_PUBLIC_ADMOB_REWARDED_ID`.

### 4.1 Variáveis e fallbacks

| Variável/constante | Lida em | Uso | Fallback no código |
|---|---|---|---|
| `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID` | `app.config.ts` | App ID Android | `ca-app-pub-3940256099942544~3347511713` |
| `EXPO_PUBLIC_ADMOB_IOS_APP_ID` | `app.config.ts` | App ID iOS | `ca-app-pub-3940256099942544~1458002511` |
| `EXPO_PUBLIC_ADMOB_REWARDED_ID` | `hooks/useRewardedAd.ts` | Ad Unit ID rewarded | `TEST_AD_ID` |
| `TEST_AD_ID` | `hooks/useRewardedAd.ts` | Unidade de teste hardcoded | `ca-app-pub-3940256099942544/5224354917` |
| `EXPO_PUBLIC_BASE_URL` | `ConfigService` e `app/donate.tsx` | URL do `appconfig.json` e da página de doação | No config: `https://mabesi.github.io/apps`; na doação: sem fallback |
| `EXPO_PUBLIC_CONFIG_URL` | **não é lida** | Documentada no README, mas o código ignora | — |

Os valores reais de produção não são reproduzidos neste documento. Eles ficam no `.env` local (git-ignored) e nos secrets do EAS. Os IDs acima com `3940256099942544` são os IDs públicos de teste do Google.

### 4.2 Regra de escolha do Ad Unit ID

```ts
const adUnitId = (realAds && !loading)
    ? (process.env.EXPO_PUBLIC_ADMOB_REWARDED_ID || TEST_AD_ID)
    : TEST_AD_ID;
```

| `realAds` | `loading` | `EXPO_PUBLIC_ADMOB_REWARDED_ID` | Unidade usada |
|---|---|---|---|
| `false` | qualquer | qualquer | `TEST_AD_ID` |
| `true` | `true` | qualquer | `TEST_AD_ID` |
| `true` | `false` | definida | valor da variável |
| `true` | `false` | vazia/ausente | `TEST_AD_ID` |

`loading` começa como `true` no `ConfigContext`. Portanto, nas primeiras renderizações o hook usa a unidade de teste; quando a configuração remota chega, `loading` vira `false` e, se `realAds` for `true`, o efeito recria o anúncio com a unidade real.

### 4.3 Onde o App ID aparece no nativo

- Android gerado: `android/app/src/main/AndroidManifest.xml` contém
  `com.google.android.gms.ads.APPLICATION_ID`.
- O manifesto atual também contém:
  - `com.google.android.gms.ads.flag.OPTIMIZE_AD_LOADING = true`
  - `com.google.android.gms.ads.flag.OPTIMIZE_INITIALIZATION = true`
- Esses arquivos são gerados e ignorados pelo Git (`/android`, `/ios`).

**Consequência:** alterar `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID` ou `EXPO_PUBLIC_ADMOB_IOS_APP_ID` exige regenerar o projeto nativo e reinstalar o app. Não basta recarregar o bundle JavaScript.

Comandos usuais:

```bash
npm run android          # gera/instala o dev client Android
npm run ios              # gera/instala o dev client iOS (macOS)
npx expo prebuild --clean
npx eas build --platform android --profile development
```

---

## 5. Configuração remota (`realAds`)

### 5.1 URL

`ConfigService` monta:

```ts
const BASE_URL = process.env.EXPO_PUBLIC_BASE_URL || 'https://mabesi.github.io/apps';
const CONFIG_URL = `${BASE_URL}/appconfig.json`;
```

Com o `.env` atual, a URL efetiva é a base configurada em `EXPO_PUBLIC_BASE_URL` + `/appconfig.json`.

> `EXPO_PUBLIC_CONFIG_URL` existe no `.env` e no README, mas **não é usada** por `ConfigService`. Alterar essa variável não muda a URL buscada.

### 5.2 Formato esperado

```json
{
  "mysplit": {
    "realAds": false,
    "launched": "2025-12-04",
    "updated": "2025-12-04"
  }
}
```

- `ConfigService` retorna apenas `data.mysplit`.
- `realAds` controla a exibição do bloco de anúncio.
- `launched` e `updated` são usados na tela de ajuda (`app/help.tsx`), não no AdMob.
- O objeto pode conter outras chaves de outros apps; o MySplit ignora o restante.

### 5.3 Default e falha

`ConfigContext.tsx` começa com:

```ts
const defaultConfig: AppConfig = {
    realAds: false,
    launched: '2025-12-04',
    updated: '2025-12-04'
};
```

- Falha de rede, HTTP não-OK ou JSON inválido → `fetchConfig` retorna `null` → o app mantém `realAds: false`.
- Não há retry automático nem cache da configuração.
- A busca acontece uma vez por montagem do `ConfigProvider` (na prática, por inicialização do app).
- Alterações no `appconfig.json` são lidas na próxima abertura do app, não em tempo real.

### 5.4 Como ativar/desativar anúncios

**Ativar:** publicar `realAds: true` no `appconfig.json` servido pela `EXPO_PUBLIC_BASE_URL`.

**Desativar:** publicar `realAds: false` (ou remover a chave; o default é `false`).

O controle é **global por configuração remota**. Não há:

- flag por usuário;
- flag por perfil EAS (`development`, `preview`, `production`);
- variável de ambiente específica para ligar/desligar anúncios;
- painel no app.

---

## 6. Botão de doação e botão de anúncio

### 6.1 Home

Em `app/index.tsx`, o botão “Donate” aparece sempre:

```tsx
<TouchableOpacity onPress={() => router.push('/donate')}>
```

Ele não consulta `realAds`. A tela de doação é acessível mesmo com anúncios desativados.

### 6.2 Tela de doação

`app/donate.tsx` tem duas ações:

1. **Doar**: sempre visível.
   - `Linking.openURL(`${process.env.EXPO_PUBLIC_BASE_URL}/donate`)`
   - Abre a página externa de doação no navegador.
2. **Ver anúncio**: visível somente se `realAds` for verdadeiro.

```tsx
{realAds && (
  <>
    <View style={styles.separator}>
      <Text>{i18n.t('or')}</Text>
    </View>
    <TouchableOpacity
      onPress={handleWatchAd}
      disabled={!loaded}
    >
      <Text>{loaded ? i18n.t('watchAd') : i18n.t('loadingAd')}</Text>
    </TouchableOpacity>
  </>
)}
```

### 6.3 Regras de bloqueio de exibição

| Condição | O bloco de anúncio aparece? | Botão clicável? | Observação |
|---|---|---|---|
| `realAds = false` | Não | — | Nem separador nem botão são renderizados. |
| `realAds = true`, config ainda carregando | Não inicialmente | — | `realAds` começa `false`; o bloco pode aparecer quando a config chega. |
| `realAds = true`, `loaded = false` | Sim | Não (`disabled`) | Texto “Loading Ad...” e opacidade reduzida. |
| `realAds = true`, `loaded = true` | Sim | Sim | Texto “Watch Ad to Support”. |
| Web com `realAds = true` | Sim | Não | O stub web mantém `loaded = false`; o botão fica permanentemente em “Loading Ad...”. |
| Falha ao buscar config | Não | — | `realAds` permanece `false`. |

Não há bloqueio por:
- perfil de build;
- plataforma Android/iOS (além do comportamento natural da web);
- idade, país, consentimento ou status de doação;
- quantidade de anúncios já assistidos.

### 6.4 Fallback sem anúncio carregado

`handleWatchAd` tem um `else` que mostra um alerta de agradecimento mesmo sem anúncio:

```tsx
if (loaded) {
    showAd();
} else {
    Alert.alert(i18n.t('success'), i18n.t('adThankYou') + '\n\n(Ad could not be loaded...)');
}
```

Porém, o `TouchableOpacity` usa `disabled={!loaded}`. Na prática, **o ramo `else` não é alcançável por toque normal**; ele só seria executado se `handleWatchAd` fosse chamado programaticamente com o botão ainda desabilitado.

### 6.5 Recompensa

- A recompensa é concedida quando o evento `RewardedAdEventType.EARNED_REWARD` dispara.
- `rewardReceived` vira `true`.
- Um `useEffect` em `app/donate.tsx` mostra `Alert.alert(success, adThankYou)`.
- Ao fechar o alerta, `resetReward()` volta `rewardReceived` para `false`.
- Não há persistência de recompensa, moeda, crédito ou entitlement. É apenas um agradecimento local.
- Fechar o anúncio antes do evento de recompensa **não** concede a recompensa.

---

## 7. Ciclo de vida do rewarded (`useRewardedAd.ts`)

### 7.1 Criação

```ts
const rewarded = RewardedAd.createForAdRequest(adUnitId, {
    requestNonPersonalizedAdsOnly: true,
});
```

- O anúncio é criado por requisição, com anúncios não personalizados.
- `rewardedRef` guarda a instância para `showAd`.

### 7.2 Eventos

| Evento | Efeito no hook | Efeito na UI |
|---|---|---|
| `RewardedAdEventType.LOADED` | `loaded = true`, `error = null` | Botão habilitado, texto “Watch Ad”. |
| `RewardedAdEventType.EARNED_REWARD` | `rewardReceived = true` | Alerta de agradecimento. |
| `AdEventType.CLOSED` | `loaded = false`; chama `rewarded.load()` | Botão volta a “Loading Ad...” enquanto recarrega. |
| `AdEventType.ERROR` | `error = 'Failed to load ad'`, `loaded = false`; agenda retry em 5 s | Botão desabilitado; erro não é exibido ao usuário, apenas logado. |

### 7.3 Tempo

- `load()` inicial é agendado com **1 segundo** de atraso para dar tempo à inicialização do AdMob.
- Em erro, o retry é agendado com **5 segundos**.
- Após `CLOSED`, o hook chama `load()` imediatamente para a próxima exibição.
- O efeito depende de `[adUnitId, realAds, loading]`; se a configuração mudar de carregando para carregada ou `realAds` mudar, o anúncio é recriado.

### 7.4 Limpeza

No unmount/recriação do efeito, o hook:

- cancela o timer de load inicial;
- cancela o timer de retry;
- remove os quatro listeners;
- zera `rewardedRef`.

### 7.5 API retornada

```ts
{
  loaded: boolean;
  rewardReceived: boolean;
  showAd: () => void;
  error: string | null;
  resetReward: () => void;
}
```

- `showAd` só chama `rewarded.show()` se `loaded` e a ref existirem; caso contrário, registra `warn`.
- `error` é preenchido, mas `app/donate.tsx` não o consome.
- `resetReward` apenas zera `rewardReceived`.

---

## 8. Inicialização nativa (`app/_layout.tsx`)

```ts
const getMobileAds = () => {
    if (Platform.OS !== 'web') {
        try {
            return require('react-native-google-mobile-ads').default;
        } catch {
            return null;
        }
    }
    return null;
};
```

No mount do layout raiz:

```ts
const mobileAds = getMobileAds();
if (mobileAds) {
    mobileAds().initialize().catch((error) => {
        logger.error('❌ AdMob initialization error:', error);
    });
}
```

- A web é ignorada.
- O `require` é protegido para não quebrar a navegação se o módulo nativo não estiver no binário.
- A inicialização acontece uma vez por execução do app.
- O SDK exige o App ID configurado no nativo; por isso o dev client/build precisa ser gerado com o plugin do `app.config.ts`.

### 8.1 O que não existe na inicialização

- Não há `AdsConsent`/UMP.
- Não há solicitação de ATT (App Tracking Transparency) no iOS.
- Não há configuração de “test devices”.
- Não há tratamento de `initialize()` com estado visual; falhas apenas vão para o logger.

---

## 9. Configuração local, EAS e secrets

### 9.1 `.env`

O `.env` é git-ignored e contém, entre outras, estas chaves:

```env
EXPO_PUBLIC_ADMOB_ANDROID_APP_ID=ca-app-pub-XXXXXXXX~YYYYYYYY
EXPO_PUBLIC_ADMOB_IOS_APP_ID=ca-app-pub-XXXXXXXX~YYYYYYYY
EXPO_PUBLIC_ADMOB_REWARDED_ID=ca-app-pub-XXXXXXXX/YYYYYYYY
EXPO_PUBLIC_BASE_URL=https://seu-dominio.example
```

- Valores reais não devem ser colados em documentação, issues ou commits.
- As chaves `EXPO_PUBLIC_*` são embutidas no bundle; não são secretas em runtime, mas não devem ser tratadas como configuração pública versionada sem necessidade.

### 9.2 EAS Secrets

`manage_secrets.sh` (git-ignored) contém os valores e executa, para cada chave:

```bash
eas secret:create --scope project --name "$KEY" --value "$VALUE" --type string --force
```

O script sincroniza as três variáveis de AdMob com o projeto EAS, além das variáveis de Firebase e `EXPO_PUBLIC_BASE_URL`.

- O script não é versionado.
- Quem clonar o projeto não recebe os valores.
- Builds EAS precisam das variáveis configuradas no projeto; caso contrário, o app.config usa os App IDs de teste e o hook usa a unidade de teste quando a variável de rewarded estiver ausente.

### 9.3 `eas.json`

Os perfis atuais são:

| Perfil | Distribuição | Observação |
|---|---|---|
| `development` | `internal` + dev client | `autoIncrement: true` |
| `preview` | `internal` + APK | Sem configuração de AdMob |
| `production` | `internal`/store + AAB | `autoIncrement: true` |

`eas.json` **não** define variáveis de AdMob nem `realAds`. A ativação de anúncios vem exclusivamente da configuração remota.

---

## 10. Como testar

### 10.1 Pré-requisitos

- Usar um **development build** (`npm run android`, `npm run ios` ou EAS `development`), pois o AdMob é um módulo nativo. Expo Go não é suficiente.
- Ter o `appconfig.json` acessível na URL configurada.
- Estar em ambiente de desenvolvimento com logs habilitados (`logger.debug` só aparece em `__DEV__`).

### 10.2 Testar o caminho de teste (sem anúncio real)

1. Deixe `realAds: false` no `appconfig.json`.
2. Abra a tela de doação.
3. O bloco de anúncio **não aparece**.
4. Nos logs, o hook ainda deve indicar a criação/load do anúncio de teste, porque ele é chamado ao montar a tela.
5. Confirme que nenhum anúncio real é solicitado.

### 10.3 Testar a UI do botão com unidade de teste

Para ver o botão e o fluxo de recompensa sem usar uma unidade de produção:

1. Configure `realAds: true` no `appconfig.json`.
2. Garanta que `EXPO_PUBLIC_ADMOB_REWARDED_ID` esteja **ausente** ou com o valor de teste `ca-app-pub-3940256099942544/5224354917`.
3. Opcionalmente, use também os App IDs de teste no lugar dos App IDs de produção.
4. Rebuild/reinstale se os App IDs tiverem mudado.
5. Abra `/donate` e aguarde o botão mudar de “Loading Ad...” para “Watch Ad to Support”.
6. Toque no botão, conclua o anúncio e confirme o alerta de agradecimento.
7. Confirme nos logs os eventos `LOADED`, `EARNED_REWARD` e `CLOSED`.

> Não use uma unidade de produção em desenvolvimento/teste. Isso pode gerar impressões inválidas e violar políticas do AdMob.

### 10.4 Testar falha e retry

1. Ative `realAds: true` com uma unidade de teste.
2. Ative o modo avião ou bloqueie a rede.
3. Abra `/donate`.
4. O botão deve permanecer desabilitado.
5. Nos logs, deve aparecer erro e a tentativa de retry após 5 s.
6. Restaure a rede e aguarde o próximo retry/load.

### 10.5 Testar web

- `hooks/useRewardedAd.web.ts` é resolvido pelo Metro no lugar do hook nativo.
- `loaded` é sempre `false`.
- `showAd` apenas registra “AdMob is not supported on web.”
- Com `realAds: true`, o bloco aparece, mas o botão fica permanentemente desabilitado em “Loading Ad...”. Com `realAds: false`, o bloco não aparece.

### 10.6 Verificações de código

```bash
npx tsc --noEmit
npm run lint
```

Não há teste automatizado de AdMob no repositório.

---

## 11. Troubleshooting

| Sintoma | Causa provável | Ação |
|---|---|---|
| Bloco de anúncio não aparece | `realAds: false`, config ainda carregando ou falha no `appconfig.json` | Verificar URL, resposta HTTP, JSON e a chave `mysplit.realAds`. Reabrir o app. |
| Botão fica em “Loading Ad...” para sempre | Nenhum evento `LOADED`; rede; unidade inválida; App ID ausente/incorreto; web | Ver logs, testar com unidade de teste, confirmar App ID no nativo e reconstruir o dev client. |
| Erro “AdMob initialization error” | SDK nativo não inicializou; App ID ausente/inválido; binário sem o módulo | Conferir `app.config.ts`, regenerar native build e reinstalar. |
| `realAds` está `true` mas o botão não aparece | Config não foi buscada; objeto sem a chave `mysplit`; `realAds` não booleano | Corrigir o JSON remoto; reiniciar o app; confirmar a URL montada. |
| Alterei `EXPO_PUBLIC_CONFIG_URL` e nada mudou | A variável não é lida pelo código | Alterar `EXPO_PUBLIC_BASE_URL` ou o `appconfig.json`; ou ajustar `ConfigService` se a intenção for usar a variável. |
| Alterei o App ID e o app não reflete | App ID é aplicado em build time | Regenerar o projeto nativo/novo build e reinstalar. |
| Alterei a unidade e o app não reflete | `EXPO_PUBLIC_*` é embutida no bundle | Gerar novo bundle/build; recarregar o Metro não altera o valor já embutido. |
| Anúncio fecha sem alerta de recompensa | Usuário fechou antes de `EARNED_REWARD` | Comportamento esperado; a recompensa só existe no evento correto. |
| Dois alertas ou alerta inesperado | O efeito observa `rewardReceived` e `resetReward`; mudanças de estado podem reexecutar o efeito | Verificar logs/eventos antes de alterar; considerar estabilizar `resetReward` com `useCallback` se for corrigir. |
| Botão de anúncio aparece na web e não funciona | `realAds: true` na web, mas o hook web é stub | Esperado no esquema atual; esconder o bloco na web se isso incomodar. |
| Nenhum anúncio é preenchido | Falta de inventário, país, teste ou limite do AdMob | Testar com unidade oficial de teste; aguardar retry; verificar conta AdMob. |

---

## 12. Limitações e pendências do esquema atual

Estes itens são **observações do código atual**, não funcionalidades implementadas:

1. **Hook chamado mesmo com anúncios desativados**: ao abrir `/donate` com `realAds: false`, o hook ainda cria e carrega uma unidade de teste. O botão não aparece, mas a requisição de teste ocorre.
2. **Fallback de “anúncio não carregado” inalcançável por toque**: o botão é `disabled={!loaded}`, então o `else` de `handleWatchAd` não é acionado normalmente.
3. **Erro não exibido**: `error` é retornado pelo hook, mas a tela de doação não mostra mensagem de falha.
4. **Sem consentimento UMP/ATT**: o SDK solicita apenas anúncios não personalizados; não há fluxo de consentimento.
5. **Sem verificação server-side**: a recompensa é local e não concede benefício persistido. Não há SSV (server-side verification).
6. **Sem limite de frequência**: o usuário pode assistir quantas vezes conseguir carregar.
7. **Controle global**: `realAds` vale para todos os usuários/instalações que buscarem a mesma configuração.
8. **Sem gate por perfil de build**: `eas.json` não diferencia anúncios entre `development`, `preview` e `production`.
9. **Web**: com `realAds: true`, o bloco aparece desabilitado para sempre; o stub não carrega anúncio.
10. **`EXPO_PUBLIC_CONFIG_URL` ignorada**: a URL é derivada de `EXPO_PUBLIC_BASE_URL`.
11. **Sem cache/retry de configuração**: falha no `appconfig.json` mantém anúncios desligados até a próxima abertura.
12. **Sem testes**: não há teste automatizado para seleção de unidade, gating ou eventos.
13. **Privacidade**: não há arquivo de política de privacidade no repositório; a declaração de dados da loja precisa cobrir o AdMob.
14. **Dependência de build nativo**: alterações de App ID exigem novo binário; alterações de unidade exigem novo bundle.

---

## 13. Checklist para alterar o esquema

### Trocar a unidade recompensada

- [ ] Atualizar `EXPO_PUBLIC_ADMOB_REWARDED_ID` no `.env` local.
- [ ] Atualizar o secret no EAS (`manage_secrets.sh` ou `eas secret:create`).
- [ ] Gerar novo bundle/build.
- [ ] Testar com unidade de teste antes de produção.

### Trocar o App ID (Android/iOS)

- [ ] Atualizar `EXPO_PUBLIC_ADMOB_ANDROID_APP_ID`/`EXPO_PUBLIC_ADMOB_IOS_APP_ID`.
- [ ] Atualizar os secrets do EAS.
- [ ] Regenerar o projeto nativo (`npx expo prebuild --clean` ou novo build EAS).
- [ ] Reinstalar o dev client/binário.
- [ ] Confirmar o `APPLICATION_ID` no manifesto Android ou `GADApplicationIdentifier` no iOS.

### Ativar anúncios reais

- [ ] Publicar `realAds: true` no `appconfig.json`.
- [ ] Confirmar que a conta AdMob está aprovada e o app/unit estão ativos.
- [ ] Confirmar que a política de privacidade e a declaração de dados estão atualizadas.
- [ ] Testar o fluxo com unidade de teste antes de mudar para produção.

### Desativar anúncios

- [ ] Publicar `realAds: false` no `appconfig.json`.
- [ ] Reabrir o app nos dispositivos de teste.
- [ ] Confirmar que o bloco de anúncio não é renderizado.

### Adicionar novos formatos

O código atual só implementa rewarded. Para banner/interstitial, será necessário:

- [ ] Adicionar novas unidades no AdMob.
- [ ] Criar componentes/hooks específicos.
- [ ] Definir posicionamento e frequência.
- [ ] Revisar políticas e UX (não forçar anúncios).
- [ ] Adicionar testes e telemetria.

---

## 14. Referência rápida

### Arquivos-chave

| Caminho | Papel |
|---|---|
| `app.config.ts` | App IDs e plugin |
| `app/_layout.tsx` | `mobileAds().initialize()` |
| `app/donate.tsx` | UI de doação e anúncio |
| `app/index.tsx` | Entrada para `/donate` |
| `context/ConfigContext.tsx` | `realAds`, `loading` |
| `services/ConfigService.ts` | `appconfig.json` |
| `hooks/useRewardedAd.ts` | Rewarded nativo |
| `hooks/useRewardedAd.web.ts` | Stub web |
| `i18n/translations.ts` | Textos |
| `.env` | IDs locais (não versionado) |
| `manage_secrets.sh` | Secrets EAS (não versionado) |

### Chaves de i18n usadas

| Chave | Uso |
|---|---|
| `supportDev` | Título da tela |
| `donationMsg` | Texto sobre doação e anúncios opcionais |
| `donate` | Botão de doação |
| `or` | Separador “ou” |
| `watchAd` | Botão quando o anúncio está pronto |
| `loadingAd` | Botão enquanto carrega |
| `adThankYou` | Alerta após recompensa |
| `success` | Título do alerta |

### Logs úteis

O hook usa `logger.debug` para:

- `🔑 Env Ad ID`
- `📱 Ad Unit ID`
- `🎯 Real Ads Mode`
- `⏳ Config Loading`
- `✅ Ad loaded successfully`
- `🎁 User earned reward`
- `🚪 Ad closed`
- `🔄 Reloading ad...`

E `logger.error` para:

- `❌ Ad error`
- `❌ Error code`
- `❌ Error message`
- `❌ AdMob initialization error`

`logger.debug` só aparece em desenvolvimento; `warn` e `error` continuam em produção.

---

## 15. Resumo do comportamento atual

1. O SDK é inicializado no root layout, apenas em plataformas nativas.
2. A configuração remota decide se o bloco de anúncio aparece (`realAds`).
3. A home sempre oferece doação; a tela de doação sempre oferece o botão externo de doação.
4. O botão de anúncio só é renderizado com `realAds: true`.
5. O botão fica desabilitado até o evento `LOADED`.
6. A unidade de teste é usada enquanto `realAds` for falso, enquanto a config carrega ou quando a variável de rewarded estiver ausente.
7. A recompensa é local, disparada apenas em `EARNED_REWARD`, e exibida como alerta de agradecimento.
8. Após fechar o anúncio, o hook tenta carregar outro.
9. Em erro, tenta novamente após 5 segundos.
10. Na web, não há anúncio; o hook é um stub.
