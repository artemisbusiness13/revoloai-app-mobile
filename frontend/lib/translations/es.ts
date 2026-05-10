import { Translations } from "./types";

// Español — partial translation. Untranslated keys auto-fallback to English.
const es = {
  meta: { name: "Spanish", code: "es", dir: "ltr" },
  common: {
    save: "Guardar", cancel: "Cancelar", continue: "Continuar", back: "Atrás", close: "Cerrar",
    open: "Abrir", refresh: "Actualizar", done: "Hecho", confirm: "Confirmar", submit: "Enviar",
    loading: "Cargando…", error: "Algo salió mal", retry: "Reintentar", gotIt: "Entendido",
  },
  home: {
    install: "Instalar", earlyAccess: "Acceso anticipado",
    heroTitle1: "Encuentra mejores empleos.",
    heroTitle2: "Practica entrevistas.",
    heroTitle3: "Consigue empleo más rápido.",
    heroSub: "Tu Asistente de Carrera con IA — tres avatares amigables te guían desde el CV hasta la oferta.",
    chooseAvatar: "Elige tu avatar",
    noSubscription: "Sin suscripción · Pago por uso",
    startWithAvatar: "Comienza con tu avatar",
    tapToExplore: "Toca cualquier tarjeta para explorar",
    startWith: "Empezar con {name}",
  },
  lang: { title: "Elige tu idioma", sub: "Traduce la app al instante" },
  avatars: {
    maya: { name: "Maya", role: "Buscadora de empleo" },
    sofia: { name: "Sofia", role: "Coach de entrevistas" },
    aria: { name: "Aria", role: "Coach de carrera" },
  },
  meetAvatars: { label: "Elige", title: "Conoce tus avatares", sub: "Tres IAs amigables, cada una con un rol claro." },
  chat: {
    placeholder: "Escribe un mensaje…", send: "Enviar", listening: "Escuchando…", speakReply: "Leer respuestas en voz alta", micPermission: "Permitir acceso al micrófono", typing: "escribiendo…",
  },
  account: {
    signupTitle: "Crea tu cuenta", signupSub: "Ayuda personalizada — empieza en 30 segundos.",
    loginTitle: "Bienvenido de nuevo", loginSub: "Inicia sesión para continuar.",
    signupTab: "Registro", loginTab: "Iniciar sesión",
    namePh: "Tu nombre", emailPh: "Correo electrónico", passwordPh: "Contraseña (mín. 6 caracteres)",
    createAccount: "Crear cuenta", logIn: "Iniciar sesión",
    fillAll: "Por favor completa todos los campos.", signupFailed: "No se pudo crear la cuenta.", loginFailed: "Correo o contraseña incorrectos.",
  },
  profile: {
    title: "Tu perfil", step: "Paso",
    s1: "Objetivos", s2: "Experiencia", s3: "Habilidades", s4: "Sobre ti",
    targetRole: "Empleo deseado", location: "Ubicación preferida", remote: "Modalidad de trabajo",
    salaryMin: "Salario mín (£/año)", salaryMax: "Salario máx (£/año)",
    availability: "Disponibilidad", seniority: "Nivel de experiencia", years: "Años de experiencia",
    experience: "Experiencia previa", education: "Educación", qualifications: "Cualificaciones",
    skills: "Habilidades clave", languages: "Idiomas",
    industries: "Sectores preferidos", industriesAvoid: "Sectores a evitar",
    strengths: "Fortalezas", weaknesses: "Debilidades",
    cvText: "CV (pegar texto)", cvPaste: "Pega tu CV aquí…", cvFilename: "Nombre del archivo CV",
    notes: "Notas adicionales", notesPh: "¿Algo más que debamos saber?",
    savedTip: "Tu perfil está cifrado y solo se usa para personalizar respuestas.",
    saveAndExit: "Guardar y salir", next: "Siguiente", finish: "Finalizar",
    signInFirst: "Por favor inicia sesión primero.",
  },
  footer: { privacy: "Privacidad", terms: "Términos", deletion: "Borrar datos", cookies: "Cookies" },
} as unknown as Translations;

export default es;
