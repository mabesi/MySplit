# MABESI MYSPLIT APP

![MySplit Logo](./assets/logo.png)

**MySplit** is a mobile application built with React Native and Expo for splitting bills among friends and managing shared expenses. The app handles scenarios where not all members participate in every transaction, continuously calculating net balances for each participant.

## 📱 Features

- **Group Management**: Create a group and share its ID; members request access and the owner approves.
- **Member Rules**: The owner's name and names already in use are reserved. Removing a member deletes the expenses paid by that member and recalculates balances.
- **Expense Tracking**: Add expenses with description, amount, date, payer, and participant selection.
- **One Currency per Group**: ISO 4217 currency chosen when the group is created. The owner can change it later without converting existing values.
- **Locale-Aware Values**: Amounts accept `1.234,56` and `1,234.56`; display uses the app language and the group currency.
- **Calendar Dates**: Expenses store a `YYYY-MM-DD` calendar date, avoiding UTC off-by-one shifts.
- **Smart Balance Calculation**: Exact division in minor units, distributing the remainder so totals always add up.
- **Payment Recording**: Record settlements between members in the group currency.
- **Offline-First Outbox**: Mutations are applied locally first, queued durably, and replayed in order when connectivity returns.
- **Group Discovery**: Groups the user owns or belongs to are recovered from Firestore even when the local list is lost.
- **Group Image Thumbnails**: Custom icons are resized/compressed on-device and stored as small base64 thumbnails in Firestore. Firebase Storage is not used.
- **Multi-language Support**: English, Portuguese, and Spanish.
- **Firebase Integration**: Firestore real-time synchronization and anonymous authentication.
- **Responsive UI**: Dark theme with gradients and edge-to-edge display.

## 🛠️ Technologies

- **React Native** (0.88.1)
- **Expo** (~58.0.26)
- **TypeScript** (~6.0.3)
- **Firebase** (^13.4.0)
  - Firestore — real-time database
  - Authentication — anonymous auth
  - Firebase Storage is **not** used
- **Expo Router** (~58.0.32)
- **Expo Dev Client** (~58.0.21)
- **Expo Image Picker** (~58.0.10)
- **Expo Image Manipulator** (~58.0.16)
- **Expo Localization** (~58.0.5)
- **i18n-js** (^4.5.4)
- **AsyncStorage** (2.2.0)
- **NetInfo** (12.0.1)
- **Google Mobile Ads** (^17.4.0)

## 📋 Prerequisites

- Node.js 20 or newer
- npm
- Android Studio + Android SDK + JDK 17 (for Android)
- Xcode (for iOS, macOS only)
- A Firebase project with Firestore and Anonymous Authentication enabled
- EAS CLI (optional, for cloud builds): `npm install -g eas-cli`

## 🚀 Installation

1. **Clone the repository**
```bash
git clone https://github.com/mabesi/MySplit.git
cd MySplit
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**

Create a `.env` file in the project root (it is git-ignored):

```env
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=...
```

Optional, depending on the features you use:

```env
EXPO_PUBLIC_BASE_URL=...
EXPO_PUBLIC_CONFIG_URL=...
EXPO_PUBLIC_ADMOB_ANDROID_APP_ID=...
EXPO_PUBLIC_ADMOB_IOS_APP_ID=...
EXPO_PUBLIC_ADMOB_REWARDED_ID=...
```

Do not commit real credentials.

4. **Configure Firebase**

- Enable **Firestore Database**.
- Enable **Anonymous Authentication**.
- Firebase Storage is not required.
- Publish the rules from `firestore.rules` (see below).

5. **Start the development app**

This project uses native modules (for example, `expo-image-manipulator`), so a **development build** is recommended instead of Expo Go.

```bash
npm run android   # builds and installs the Android dev client
npm run ios       # builds and installs the iOS dev client (macOS)
```

Then start Metro for the dev client:

```bash
npx expo start --dev-client
```

If Metro is serving a stale bundle:

```bash
npx expo start -c
```

For a cloud development build:

```bash
npx eas build --profile development --platform android
```

Install the generated APK, then run `npx expo start --dev-client` and connect.

## 📜 Scripts

- `npm start` — starts Metro
- `npm run android` — builds/installs the Android development client (`expo run:android`)
- `npm run ios` — builds/installs the iOS development client (`expo run:ios`)
- `npm run web` — starts the web version

## 📦 Building for Distribution

```bash
# Internal APK
npx eas build --platform android --profile preview

# Production app bundle
npx eas build --platform android --profile production
```

The `development` profile is configured with `autoIncrement: true`, so its Android version code is bumped automatically.

## 🔒 Firestore Security

The app uses Firebase **Anonymous Authentication**. Each installation receives a UID that identifies the owner and group memberships.

Current rules model (`firestore.rules`):

- Authenticated users can read a group by its **exact ID**.
- Collection listing is limited to the discovery queries:
  - `where('ownerId', '==', uid)`
  - `where('memberIds', 'array-contains', uid)`
  - both with `limit <= 100`
- Only the owner can remove/approve members or change the group currency/name/image.
- Active members can add local members and append expenses created by themselves.
- Expenses can only reference active members.
- `memberIds` and `activeMemberIds` are derived from `members` and used by the rules.
- Currency changes are owner-only and must not alter existing expenses.
- Group images are small base64 thumbnails; new images are capped at 200 KB.

### Publishing the rules

There is no `firebase.json`/`.firebaserc` committed, so the rules are published manually:

1. Open **Firebase Console → Firestore Database → Rules**.
2. Paste the contents of `firestore.rules`.
3. Publish.

If you prefer the CLI, add a `firebase.json` pointing to `firestore.rules` and deploy with `firebase deploy --only firestore:rules`.

### Legacy groups

Groups created before the current schema may not have `memberIds`, `activeMemberIds`, or `currency`:

- The owner should open the group once so the app can backfill the ID arrays.
- If the currency is missing, the owner sets it once in **Group Settings**.
- Until then, non-owner writes may be blocked by the rules.

### Anonymous UID warning

The anonymous UID is stored locally. Uninstalling the app or clearing its data can change the UID and make existing groups appear to belong to another account. Avoid uninstalling the app on devices that own important groups.

## 🗂️ Data Model

`Group`:

- `id`, `name`, `currency`, `ownerId`
- `members`: member objects (`id`, `name`, `status`, optional `virtual`)
- `memberIds`: all member IDs
- `activeMemberIds`: active member IDs
- `expenses`: expense objects
- `createdAt`, `updatedAt`, `version`

`Expense`:

- `id`, `title`, `amount`
- `paidBy`, `splitAmong`
- `date` (timestamp used for sorting), `dateString` (`YYYY-MM-DD` used for display)
- `createdBy`, `createdAt`

## 📱 App Structure

```
MySplit/
├── app/                      # Expo Router pages
│   ├── index.tsx            # Home, group discovery, create/join
│   ├── group/
│   │   ├── [id].tsx         # Group details, expenses, balances
│   │   ├── members.tsx      # Pending requests and members
│   │   └── settings.tsx     # Image, currency, sharing, deletion
│   ├── help.tsx             # Help screen
│   ├── donate.tsx           # Donation screen
│   └── _layout.tsx          # Root layout
├── components/              # CurrencyPicker, ScreenWrapper, SyncIndicator
├── context/                 # GroupContext, ConfigContext
├── services/
│   ├── FirebaseService.ts   # Firestore implementation
│   ├── MockService.ts       # Local mock implementation
│   ├── StorageInterface.ts  # Storage abstraction
│   ├── LocalGroupStore.ts   # Local persistence
│   ├── OperationQueue.ts    # Durable outbox
│   ├── OperationProcessor.ts# Outbox replay/retry
│   └── ConfigService.ts     # Remote config
├── utils/
│   ├── currency.ts          # ISO currency, minor units, formatting
│   ├── date.ts              # Local calendar-date helpers
│   ├── number.ts            # Localized amount parsing
│   ├── memberLogic.ts       # Member approval/merge/removal rules
│   └── splitLogic.ts        # Balance and settlement calculation
├── i18n/                    # English, Portuguese, Spanish
├── types/                   # TypeScript definitions
└── assets/                  # Images and icons
```

## 🌍 Internationalization

The app supports English, Portuguese, and Spanish. The language is selected on the home screen.

- Language controls number separators and date formatting.
- Currency is independent: it comes from the group and is formatted with `Intl.NumberFormat`.
- Examples:
  - `pt-BR` + `BRL` → `R$ 1.234,56`
  - `pt-BR` + `USD` → `US$ 1.234,56`
  - `en-US` + `BRL` → `R$1,234.56`
  - `ja-JP` + `JPY` → `￥1,235`

## 🎨 Design

- Dark theme with gradient backgrounds
- Edge-to-edge display
- Responsive layout
- Custom vector icons from Expo Vector Icons

## ⚠️ Known Limitations

- Firestore rules must be published manually (or via a CLI setup you add).
- One currency per group; changing it relabels values but does not convert them.
- Group images are small thumbnails stored in Firestore; there is no full-resolution cloud image.
- Removed members can still read a group if they know its ID (authenticated read by ID).
- There is no ownership transfer flow yet.
- No lint/test/CI pipeline is configured in the repository.

## 📄 License

This project is licensed under the [MIT License](https://opensource.org/license/MIT).

## ⚠️ Disclaimer

Use this tool at your own risk. You are solely responsible for any legal implications arising from its use. It is the end user's responsibility to know and obey all applicable local, state, and federal laws. Developers are not liable for any misuse or damage caused by this program.

## 👨‍💻 Author

**Plinio Mabesi**
- GitHub: [@mabesi](https://github.com/mabesi)
- Email: pliniomabesi@gmail.com

## 🤝 Contributing

Contributions, issues, and feature requests are welcome. See the [issues page](https://github.com/mabesi/MySplit/issues).

## ⭐ Show your support

Give a ⭐️ if this project helped you!

---

Made with ❤️ by Plinio Mabesi
