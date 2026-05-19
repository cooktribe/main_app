Making Cooktribe APK
Git init
npm i -g eas-cli
eas login
eas build:configure
eas secret:push --scope project --env-file .env
eas build -p android --profile productionApk
