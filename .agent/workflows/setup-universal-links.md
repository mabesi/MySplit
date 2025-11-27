---
description: Como configurar Universal Links (iOS) e App Links (Android) para links clicáveis
---

# Configurar Universal Links e App Links

Este guia explica como configurar links clicáveis que abrem o app MySplit automaticamente quando clicados no WhatsApp, email, etc.

## Pré-requisitos

1. **Domínio próprio** (ex: `mysplit.app` ou `join.mysplit.app`)
2. **Acesso ao servidor web** para hospedar arquivos de verificação
3. **App publicado** na App Store (iOS) e/ou Google Play (Android)

## Passo 1: Escolher o formato da URL

Decida o formato das suas URLs. Exemplos:
- `https://mysplit.app/join/GROUP_ID`
- `https://join.mysplit.app/GROUP_ID`
- `https://mysplit.app/g/GROUP_ID`

## Passo 2: Configurar o servidor web

### 2.1 Criar página de redirecionamento

Crie uma página web simples que:
1. Tenta abrir o app usando o custom scheme (`mysplit://`)
2. Se falhar (app não instalado), redireciona para a loja (App Store/Play Store)

Exemplo de `index.html`:

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Join MySplit Group</title>
    <script>
        // Extrair o Group ID da URL
        const pathParts = window.location.pathname.split('/');
        const groupId = pathParts[pathParts.length - 1];
        
        // Tentar abrir o app
        window.location.href = `mysplit://join?groupId=${groupId}`;
        
        // Após 2 segundos, redirecionar para a loja se o app não abrir
        setTimeout(() => {
            const userAgent = navigator.userAgent || navigator.vendor;
            if (/android/i.test(userAgent)) {
                window.location.href = 'https://play.google.com/store/apps/details?id=com.yourcompany.mysplit';
            } else if (/iPad|iPhone|iPod/.test(userAgent)) {
                window.location.href = 'https://apps.apple.com/app/mysplit/idXXXXXXXXX';
            }
        }, 2000);
    </script>
</head>
<body>
    <h1>Opening MySplit...</h1>
    <p>If the app doesn't open, download it from your app store.</p>
</body>
</html>
```

### 2.2 Configurar iOS Universal Links

Crie o arquivo `apple-app-site-association` (sem extensão) na raiz do seu domínio:

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAM_ID.com.yourcompany.mysplit",
        "paths": ["/join/*", "/g/*"]
      }
    ]
  }
}
```

**Importante:**
- Substitua `TEAM_ID` pelo seu Apple Team ID
- Substitua `com.yourcompany.mysplit` pelo seu Bundle ID
- Hospede em `https://yourdomain.com/.well-known/apple-app-site-association`
- O arquivo deve ser servido com `Content-Type: application/json`
- Deve ser acessível via HTTPS (SSL obrigatório)

### 2.3 Configurar Android App Links

Crie o arquivo `assetlinks.json` em `.well-known/`:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.yourcompany.mysplit",
    "sha256_cert_fingerprints": [
      "YOUR_SHA256_FINGERPRINT_HERE"
    ]
  }
}]
```

**Como obter o SHA256 fingerprint:**

```bash
# Para release keystore
keytool -list -v -keystore your-release-key.keystore -alias your-key-alias

# Para debug (desenvolvimento)
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```

Hospede em `https://yourdomain.com/.well-known/assetlinks.json`

## Passo 3: Atualizar app.json

Adicione a configuração de associação de domínio:

```json
{
  "expo": {
    "scheme": "mysplit",
    "ios": {
      "bundleIdentifier": "com.yourcompany.mysplit",
      "associatedDomains": [
        "applinks:yourdomain.com",
        "applinks:www.yourdomain.com"
      ]
    },
    "android": {
      "package": "com.yourcompany.mysplit",
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [
            {
              "scheme": "https",
              "host": "yourdomain.com",
              "pathPrefix": "/join"
            },
            {
              "scheme": "https",
              "host": "yourdomain.com",
              "pathPrefix": "/g"
            }
          ],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    }
  }
}
```

## Passo 4: Atualizar o código do app

### 4.1 Modificar app/_layout.tsx

Atualize o handler de deep links para aceitar URLs HTTPS:

```typescript
const handleDeepLink = (event: { url: string }) => {
    const url = event.url;
    let groupId = null;
    
    // Formato: mysplit://join?groupId=xxx
    if (url.includes('mysplit://join')) {
        groupId = url.split('groupId=')[1];
    }
    // Formato: https://yourdomain.com/join/xxx ou /g/xxx
    else if (url.includes('/join/') || url.includes('/g/')) {
        const parts = url.split('/');
        groupId = parts[parts.length - 1];
    }
    
    if (groupId) {
        router.push(`/?joinGroupId=${groupId}`);
    }
};
```

### 4.2 Atualizar app/group/settings.tsx

Mude o formato da URL compartilhada:

```typescript
const handleShareGroup = async () => {
    try {
        const shareUrl = `https://yourdomain.com/join/${currentGroup.id}`;
        const message = i18n.t('shareGroupMessage', { groupName: currentGroup.name });
        
        await Share.share({
            message: `${message}\n\n${shareUrl}`,
            url: shareUrl,
            title: i18n.t('shareGroup')
        });
    } catch (error) {
        console.error('Error sharing group:', error);
    }
};
```

## Passo 5: Testar

### Teste local (antes de publicar):

1. Use o Expo Development Build (não funciona com Expo Go)
2. Configure um servidor local com ngrok para testar:
   ```bash
   ngrok http 80
   ```
3. Use a URL do ngrok temporariamente

### Teste em produção:

1. Publique o app nas lojas
2. Compartilhe um link de teste
3. Clique no link em diferentes apps (WhatsApp, email, navegador)
4. Verifique se o app abre automaticamente

## Verificação

### iOS:
- Acesse: `https://yourdomain.com/.well-known/apple-app-site-association`
- Deve retornar o JSON sem erros
- Use a ferramenta da Apple: https://search.developer.apple.com/appsearch-validation-tool/

### Android:
- Acesse: `https://yourdomain.com/.well-known/assetlinks.json`
- Teste com: https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://yourdomain.com

## Troubleshooting

### Links não abrem o app:

1. **iOS**: Verifique se o certificado SSL é válido
2. **Android**: Confirme que o SHA256 fingerprint está correto
3. **Ambos**: Certifique-se de que os arquivos estão acessíveis via HTTPS
4. Limpe o cache do app e reinstale

### App abre mas não navega para o grupo:

1. Verifique os logs do console
2. Confirme que o handler de deep link está capturando a URL
3. Teste o parsing do groupId

## Recursos adicionais

- [Expo Linking Documentation](https://docs.expo.dev/guides/linking/)
- [iOS Universal Links](https://developer.apple.com/ios/universal-links/)
- [Android App Links](https://developer.android.com/training/app-links)
