---
description: Como publicar o app MySplit na Google Play Store
---

# Publicar na Google Play Store

Este guia explica o processo completo para publicar o MySplit na Google Play Store.

## Pré-requisitos

1. **Conta Google Play Console** (taxa única de $25 USD)
2. **Conta Expo/EAS** (já configurada)
3. **App testado e funcionando** ✅
4. **Assets preparados** (ícones, screenshots, descrições)

## Parte 1: Preparar Assets e Informações

### 1.1 Screenshots (Obrigatório)

Você precisa de **pelo menos 2 screenshots** de diferentes telas do app:

**Requisitos:**
- Formato: PNG ou JPEG
- Tamanho mínimo: 320px
- Tamanho máximo: 3840px
- Proporção: 16:9 ou 9:16

**Telas sugeridas para capturar:**
1. Tela inicial (criar/entrar em grupo)
2. Tela de detalhes do grupo (com despesas)
3. Tela de balanços
4. Tela de configurações do grupo

### 1.2 Ícone da Play Store (Obrigatório)

- **Tamanho:** 512x512 px
- **Formato:** PNG de 32 bits
- **Sem transparência**
- Já temos: `assets/icon.png` (precisa verificar se é 512x512)

### 1.3 Feature Graphic (Obrigatório)

- **Tamanho:** 1024x500 px
- **Formato:** PNG ou JPEG
- Banner promocional que aparece na Play Store

### 1.4 Descrições

Prepare os seguintes textos:

**Título do App** (máx 50 caracteres):
```
MySplit - Dividir Contas
```

**Descrição Curta** (máx 80 caracteres):
```
Divida despesas com amigos de forma simples e justa
```

**Descrição Completa** (máx 4000 caracteres):
```
MySplit é o app perfeito para dividir contas com amigos, família ou colegas de quarto!

🎯 RECURSOS PRINCIPAIS:
• Crie grupos ilimitados para diferentes ocasiões
• Adicione despesas e escolha quem participou
• Cálculo automático de quem deve para quem
• Sincronização em tempo real entre membros
• Interface moderna e intuitiva
• Funciona offline

💰 COMO FUNCIONA:
1. Crie um grupo ou entre em um existente
2. Adicione membros
3. Registre as despesas
4. Veja automaticamente quem deve para quem
5. Marque pagamentos como "acertados"

✨ PERFEITO PARA:
• Viagens com amigos
• Dividir aluguel e contas
• Churrascos e festas
• Qualquer situação onde você divide gastos

🔒 PRIVACIDADE:
• Seus dados são seguros
• Sem anúncios intrusivos
• Sem venda de dados

Baixe agora e simplifique a divisão de contas!
```

### 1.5 Categoria

Escolha: **Finanças** ou **Produtividade**

### 1.6 Informações de Contato

- **Email de suporte:** (seu email)
- **Website:** https://www.mabesi.app
- **Política de Privacidade:** (URL obrigatória - vamos criar)

## Parte 2: Criar Política de Privacidade

A Play Store **exige** uma política de privacidade. Crie um arquivo simples:

**Sugestão de conteúdo:**
```markdown
# Política de Privacidade - MySplit

Última atualização: [DATA]

## Coleta de Dados
O MySplit coleta apenas os dados necessários para o funcionamento do app:
- Nome de usuário escolhido por você
- Informações de grupos e despesas que você cria

## Uso dos Dados
Seus dados são usados exclusivamente para:
- Sincronizar informações entre membros do grupo
- Calcular divisões de despesas

## Armazenamento
Os dados são armazenados de forma segura no Firebase (Google Cloud).

## Compartilhamento
Não vendemos, alugamos ou compartilhamos seus dados com terceiros.

## Seus Direitos
Você pode deletar seus dados a qualquer momento deletando o grupo.

## Contato
Para dúvidas: [SEU EMAIL]
```

**Hospede em:** GitHub Pages, seu site, ou use um gerador gratuito como https://www.privacypolicygenerator.info/

## Parte 3: Gerar Build de Produção

### 3.1 Atualizar app.json

Verifique se está tudo correto:

```json
{
  "expo": {
    "version": "1.0.0",
    "android": {
      "versionCode": 1,
      "package": "com.mabesi.mysplit"
    }
  }
}
```

### 3.2 Gerar AAB (Android App Bundle)

```bash
# turbo
eas build --platform android --profile production
```

**Importante:** 
- A Play Store exige **AAB** (não APK) desde 2021
- O profile "production" já está configurado para gerar AAB
- Este build levará ~15-20 minutos

### 3.3 Aguardar e Baixar

Quando o build terminar:
1. Acesse o link fornecido
2. Baixe o arquivo `.aab`
3. Guarde em local seguro

## Parte 4: Criar App na Play Console

### 4.1 Acessar Play Console

1. Vá para: https://play.google.com/console
2. Faça login com sua conta Google
3. Se for a primeira vez, pague a taxa de $25 USD

### 4.2 Criar Novo App

1. Clique em **"Criar app"**
2. Preencha:
   - **Nome:** MySplit - Dividir Contas
   - **Idioma padrão:** Português (Brasil)
   - **App ou jogo:** App
   - **Gratuito ou pago:** Gratuito
3. Aceite os termos
4. Clique em **"Criar app"**

### 4.3 Configurar Painel

Você verá uma lista de tarefas. Complete cada uma:

#### A) Configurar App

1. **Categoria do app:**
   - Categoria: Finanças
   - Tags: (opcional)

2. **Detalhes de contato:**
   - Email: [seu email]
   - Website: https://www.mabesi.app
   - Telefone: (opcional)

3. **Política de privacidade:**
   - Cole a URL da sua política

#### B) Configurar Ficha da Loja

1. **Detalhes do app:**
   - Título curto: MySplit
   - Descrição completa: [use o texto preparado]
   - Descrição curta: [use o texto preparado]

2. **Recursos gráficos:**
   - Ícone: Upload do icon.png (512x512)
   - Feature graphic: Upload da imagem 1024x500
   - Screenshots: Upload de pelo menos 2 screenshots

3. **Categorização:**
   - Categoria: Finanças
   - Público-alvo: Maiores de 3 anos (ou conforme apropriado)

#### C) Classificação de Conteúdo

1. Clique em **"Iniciar questionário"**
2. Responda as perguntas sobre o conteúdo do app
3. Geralmente apps de finanças são classificados como "Livre"

#### D) Público-alvo e Conteúdo

1. **Público-alvo:**
   - Selecione faixas etárias apropriadas
   - Para MySplit: "18 anos ou mais" é seguro

2. **Apps para crianças:**
   - Selecione "Não" (a menos que seja especificamente para crianças)

#### E) Seleção de Países

1. **Países e regiões:**
   - Selecione os países onde quer disponibilizar
   - Sugestão: Começar com Brasil, depois expandir

## Parte 5: Upload do Build

### 5.1 Criar Versão de Produção

1. No menu lateral, vá em **"Produção"**
2. Clique em **"Criar nova versão"**
3. Clique em **"Upload"**
4. Faça upload do arquivo `.aab` gerado pelo EAS

### 5.2 Preencher Notas da Versão

```
Versão 1.0.0 - Lançamento Inicial

• Crie e gerencie grupos de despesas
• Adicione membros e despesas
• Cálculo automático de divisão
• Sincronização em tempo real
• Interface moderna e intuitiva
```

### 5.3 Revisar e Publicar

1. Clique em **"Revisar versão"**
2. Verifique se todas as informações estão corretas
3. Clique em **"Iniciar lançamento para produção"**

## Parte 6: Processo de Revisão

### 6.1 Aguardar Aprovação

- **Tempo:** Geralmente 1-3 dias (pode levar até 7 dias)
- **Status:** Acompanhe em "Painel" > "Status da versão"

### 6.2 Possíveis Problemas

Se rejeitado, motivos comuns:

1. **Política de privacidade ausente/inválida**
   - Solução: Adicione URL válida

2. **Screenshots inadequados**
   - Solução: Use screenshots reais do app

3. **Descrição enganosa**
   - Solução: Seja honesto sobre funcionalidades

4. **Permissões não justificadas**
   - Solução: Remova permissões desnecessárias

### 6.3 Após Aprovação

Quando aprovado:
- O app ficará disponível na Play Store em algumas horas
- Você receberá email de confirmação
- Link da Play Store: `https://play.google.com/store/apps/details?id=com.mabesi.mysplit`

## Parte 7: Atualizações Futuras

### 7.1 Incrementar Versão

Antes de cada atualização, edite `app.json`:

```json
{
  "expo": {
    "version": "1.0.1",  // Incrementar
    "android": {
      "versionCode": 2   // Incrementar (sempre maior que anterior)
    }
  }
}
```

### 7.2 Gerar Nova Build

```bash
eas build --platform android --profile production
```

### 7.3 Upload Nova Versão

1. Play Console > Produção > Criar nova versão
2. Upload do novo `.aab`
3. Adicionar notas da versão
4. Publicar

## Checklist Final

Antes de publicar, verifique:

- [ ] Conta Play Console criada e paga ($25)
- [ ] Política de privacidade publicada (URL)
- [ ] Ícone 512x512 preparado
- [ ] Feature graphic 1024x500 preparado
- [ ] Pelo menos 2 screenshots
- [ ] Descrições escritas
- [ ] Build AAB gerado com `eas build --profile production`
- [ ] App testado e funcionando
- [ ] Todas as seções da Play Console preenchidas
- [ ] Classificação de conteúdo completa
- [ ] Países selecionados

## Dicas Importantes

1. **Teste antes de publicar:** Use o profile "preview" para testar
2. **Versão incremental:** Sempre aumente versionCode
3. **Backup do keystore:** O EAS gerencia isso automaticamente
4. **Monitore reviews:** Responda feedback dos usuários
5. **Analytics:** Configure Firebase Analytics para métricas

## Recursos Úteis

- **Play Console:** https://play.google.com/console
- **EAS Build:** https://expo.dev/accounts/mabesi/projects/mysplit
- **Documentação EAS:** https://docs.expo.dev/submit/android/
- **Políticas Play Store:** https://play.google.com/about/developer-content-policy/

## Próximos Passos Após Publicação

1. Compartilhe o link da Play Store
2. Peça reviews de amigos/usuários
3. Monitore crashes e bugs
4. Planeje próximas features
5. Considere publicar no iOS (App Store)
