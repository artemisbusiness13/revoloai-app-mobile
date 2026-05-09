# RevoloAI - Career Spark Mobile App

## Overview
Premium mobile-first re-implementation of revoloai (career-spark-ai) Lovable web app in Expo React Native.
Three AI career assistants (Maya, Sofia, Aria) help users find jobs, practice interviews, and plan careers.

## Key Features
- Hero section with three AI avatar trio (Maya - Job Finder, Sofia - Interview Coach, Aria - Career Coach)
- Language selector with 8 languages (English, Urdu, Hindi, Punjabi, Bengali, Romanian, German, Polish)
- Trust & Safety section (Privacy, Data Deletion, Stripe/PayPal, No card data stored)
- Three service sections with 3 pricing tiers each (jobs, interview, career coaching)
- Smart bundles with discount badges (Save 20%, 35%, 24%)
- Conversation demo (chat preview with Sofia)
- How it works (4-step explainer)
- Final CTA card on dark gradient
- Sticky bottom bar with avatar nav + primary CTA
- Subtle press animations + haptic feedback throughout

## Tech Stack
- Expo SDK 54 (React Native 0.81)
- expo-router (file-based routing)
- react-native-safe-area-context, react-native-gesture-handler
- expo-linear-gradient, expo-blur, expo-haptics
- @expo/vector-icons (Ionicons)
- FastAPI backend (serves avatar PNGs at /api/avatars/{name})
- MongoDB (status_checks placeholder)

## Notes
- Avatars served by FastAPI from /app/frontend/assets/images/avatar-{name}.png
- Web platform uses native `<img>` for reliable rendering; native uses RN Image
- Theme: light, premium, indigo primary (#5B5FE9), per-avatar accents (cyan/pink/violet)
