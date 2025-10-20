# Money Tracker Pro - Play Store Publishing Guide

## 📱 Preparing Your App for Google Play Store

### Prerequisites
1. **Google Play Console Account**: You need a Google Play Console developer account ($25 one-time fee)
2. **Android Studio**: Install Android Studio for building the release APK/AAB
3. **Java Keytool**: For generating keystore files (comes with Android Studio)

## 🔐 Step 1: App Signing Setup

### Generate Keystore File
```bash
# Navigate to the android/app directory
cd android/app

# Generate keystore (replace passwords with your own)
keytool -genkeypair -v -keystore money-tracker-pro-release-key.jks -keystore-type PKCS12 -alias money-tracker-pro -keyalg RSA -keysize 2048 -validity 10000

# When prompted, enter:
# - Keystore password: (choose a strong password)
# - Key password: (use same or different password)
# - Your name and organization info
```

### Configure Signing
1. Copy the generated `money-tracker-pro-release-key.jks` file to `android/app/`
2. Add `android/app/signing.gradle` (create this file):

```gradle
android {
    signingConfigs {
        release {
            storeFile file('money-tracker-pro-release-key.jks')
            storePassword project.hasProperty('STOREPASS') ? STOREPASS : ''
            keyAlias project.hasProperty('KEYALIAS') ? KEYALIAS : ''
            keyPassword project.hasProperty('KEYPASS') ? KEYPASS : ''
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

3. Update `android/app/build.gradle` to include: `apply from: 'signing.gradle'`

## 🏗️ Step 2: Build Release Version

### Using our custom script:
```bash
# In project root
npm run android:build
```

### Manual build:
```bash
# Build web assets
npm run build

# Sync with Android
npx cap sync android

# Build release AAB (recommended for Play Store)
cd android
./gradlew bundleRelease

# Or build APK (alternative)
./gradlew assembleRelease
```

### Output files:
- **AAB**: `android/app/build/outputs/bundle/release/app-release.aab` (recommended)
- **APK**: `android/app/build/outputs/apk/release/app-release.apk`

## 📋 Step 3: Google Play Console Setup

### App Listing Information
- **App name**: Money Tracker Pro
- **Package name**: com.personalfinancehub.moneytracker
- **App category**: Finance
- **Content rating**: Universal (or appropriate rating)

### Required Assets (will be created in next step):
1. **App icon**: 512x512px PNG (required)
2. **Feature graphic**: 1024x500px (optional but recommended)
3. **Screenshots**: Minimum 2 screenshots per device type
4. **App description**: Short and detailed description

### Privacy Policy
You MUST have a privacy policy URL since your app:
- Connects to the internet (Supabase)
- Handles financial data
- Stores user information

## 🎨 Step 4: Create Play Store Assets

### App Icon Requirements
- Format: PNG (32-bit)
- Size: 512x512 pixels
- Style: Simple, recognizable design
- Background: Can be transparent or colored

### Screenshots Required
**Mobile phones** (minimum requirements):
- Between 2-8 screenshots
- Aspect ratio: Maximum of 2:1
- Format: PNG or JPEG
- Size: At least 320 pixels on the short side

**Tablets** (optional but recommended):
- Between 2-8 screenshots
- Show landscape mode if supported

### Recommended Screenshots:
1. **Dashboard/home screen**
2. **Add transaction dialog**
3. **Transaction list view**
4. **Reports/charts view**
5. **Settings screen**

## 📝 Step 5: App Description

### Short Description (80 characters)
```
Track expenses, manage earnings, and monitor business finances efficiently.
```

### Full Description Template:
```
💰 Money Tracker Pro - Professional Financial Management

Take control of your finances with Money Tracker Pro, a comprehensive expense and income tracking application designed for individuals and small businesses.

🔹 KEY FEATURES:
• Track daily expenses and income
• Manage customer transactions
• Loan tracking and management
• Generate financial reports
• Secure data storage
• Multiple payment categories
• Date-wise payment tracking
• Customer balance statements
• Professional dashboard

🔹 PERFECT FOR:
• Small business owners
• Freelancers and consultants
• Personal finance management
• Expense tracking
• Income monitoring
• Budget planning

🔹 SECURITY & PRIVACY:
• Secure cloud storage (Supabase)
• Encrypted data transmission
• Local data backup
• Privacy-focused design

Start managing your finances like a pro today!

Note: This app requires an internet connection for data synchronization.
```

## 🚀 Step 6: Publishing Process

### Upload App
1. Go to Google Play Console
2. Create new app or select draft app
3. Upload your AAB file (`app-release.aab`)
4. Fill in store listing details
5. Complete content rating questionnaire
6. Set up Pricing & Distribution

### Testing
1. **Internal testing**: Test with Google email accounts
2. **Closed testing**: Test with selected users
3. **Open testing**: Public beta (optional)

### Release
1. Review all information
2. Submit for review
3. Wait for Google's approval (usually 1-3 days)
4. App goes live after approval

## 🔧 Troubleshooting

### Common Issues:
1. **Keystore errors**: Ensure keystore file is in correct location
2. **Build failures**: Run `./gradlew clean` before building
3. **App crashes**: Test on real device before publishing
4. **Size too large**: Use AAB format instead of APK

### Support Files:
- `android/app/proguard-rules.pro` - Code obfuscation rules
- `android/app/build-output.gradle` - Build configuration template

## 📱 Final Checklist

Before submitting to Play Store:
- [ ] App builds successfully in release mode
- [ ] App icon created and uploaded
- [ ] Screenshots taken and uploaded
- [ ] App description written and uploaded
- [ ] Privacy policy URL added
- [ ] Content rating completed
- [ ] AAB file uploaded
- [ ] Internal testing completed
- [ ] App tested on real Android device

## 🆘 Support

If you encounter issues:
1. Check Android Studio build logs
2. Verify all keystore passwords are correct
3. Ensure all dependencies are properly installed
4. Test app functionality thoroughly before publishing

---

**Good luck with your Money Tracker Pro app launch! 🎉**
