---
description: Como gerar o primeiro APK para teste de instalação
---

# Gerar APK para Teste

Este guia explica como gerar um APK do MySplit para instalar e testar em dispositivos Android.

## Opção 1: Build Local com EAS (Recomendado)

### Pré-requisitos
1. Conta Expo (gratuita)
2. EAS CLI instalado

### Passos

#### 1. Instalar EAS CLI
```bash
npm install -g eas-cli
```

#### 2. Login no Expo
```bash
eas login
```

#### 3. Configurar o projeto
```bash
eas build:configure
```

Isso criará o arquivo `eas.json` automaticamente.

#### 4. Gerar APK de desenvolvimento
```bash
eas build --platform android --profile preview
```

**Opções:**
- `--profile preview`: Gera APK instalável (não precisa Google Play)
- `--profile development`: Gera APK com ferramentas de debug
- `--profile production`: Gera AAB para publicar na Play Store

#### 5. Aguardar o build
- O build acontece nos servidores do Expo (gratuito)
- Você receberá um link para download quando terminar
- Tempo estimado: 10-20 minutos

#### 6. Baixar e instalar
- Acesse o link fornecido
- Baixe o APK
- Transfira para seu dispositivo Android
- Habilite "Instalar apps de fontes desconhecidas" nas configurações
- Instale o APK

## Opção 2: Build Local (Mais Complexo)

### Pré-requisitos
1. Android Studio instalado
2. Java JDK 11 ou superior
3. Variáveis de ambiente configuradas

### Passos

#### 1. Instalar dependências
```bash
npm install
```

#### 2. Gerar projeto Android nativo
```bash
npx expo prebuild --platform android
```

Isso cria a pasta `android/` com o projeto nativo.

#### 3. Gerar APK
```bash
cd android
./gradlew assembleRelease
```

O APK será gerado em:
```
android/app/build/outputs/apk/release/app-release.apk
```

#### 4. (Opcional) Assinar o APK

Para distribuir, você precisa assinar o APK:

```bash
# Gerar keystore (primeira vez)
keytool -genkeypair -v -storetype PKCS12 -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000

# Assinar APK
jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 -keystore my-release-key.keystore app-release.apk my-key-alias

# Alinhar APK
zipalign -v 4 app-release.apk mysplit-signed.apk
```

## Opção 3: Expo Go (Apenas para Testes Rápidos)

**Limitação:** Não funciona com todas as features (ex: Firebase pode ter problemas)

```bash
npx expo start
```

Escaneie o QR code com o app Expo Go.

## Configurações Importantes no app.json

Antes de gerar o APK, verifique:

```json
{
  "expo": {
    "name": "MySplit",
    "slug": "mysplit",
    "version": "1.0.0",
    "android": {
      "package": "com.yourcompany.mysplit",
      "versionCode": 1,
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#0F172A"
      },
      "permissions": [
        "INTERNET",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE"
      ]
    }
  }
}
```

**Importante:** Troque `com.yourcompany.mysplit` por um package único (ex: `com.mabesi.mysplit`)

## Configurar eas.json (para EAS Build)

Crie ou edite `eas.json`:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "aab"
      }
    }
  }
}
```

## Troubleshooting

### Erro: "Package name already exists"
- Mude o `package` no `app.json` para algo único

### Erro: "Firebase not configured"
- Certifique-se de que `google-services.json` está em `android/app/` (se usando build local)
- Para EAS, adicione no `eas.json`:
```json
{
  "build": {
    "preview": {
      "android": {
        "googleServicesFile": "./google-services.json"
      }
    }
  }
}
```

### APK muito grande
- Use `--profile production` para build otimizado
- Remova assets não utilizados

### Erro ao instalar no dispositivo
- Verifique se "Fontes desconhecidas" está habilitado
- Desinstale versões antigas primeiro
- Verifique se o dispositivo tem espaço suficiente

## Recomendação

Para o primeiro teste, use **EAS Build com profile preview**:

```bash
# turbo
eas build --platform android --profile preview
```

É mais simples, não requer configuração local do Android Studio, e o build é gratuito.

## Próximos Passos

Após testar o APK:
1. Ajuste bugs encontrados
2. Aumente o `versionCode` no `app.json`
3. Gere novo APK
4. Quando estiver pronto, use `--profile production` para publicar na Play Store
