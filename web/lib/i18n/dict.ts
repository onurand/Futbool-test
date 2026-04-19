export type Lang = "tr" | "en";

export const DICT = {
  // Nav
  nav_matches:   { tr: "Maçlar",    en: "Matches" },
  nav_analysis:  { tr: "Analiz",    en: "Analysis" },
  nav_packages:  { tr: "Paketler",  en: "Packages" },
  nav_account:   { tr: "Hesabım",   en: "Account" },

  // App
  app_tagline:   { tr: "Akıllı futbol analizi", en: "Smart football analysis" },

  // Matches screen
  today:           { tr: "Bugün",              en: "Today" },
  england_fixtures:{ tr: "İngiltere maçları",  en: "England fixtures" },
  live_odds:       { tr: "Canlı oran",         en: "Live odds" },
  other_fixtures:  { tr: "Diğer maçlar",       en: "Other fixtures" },
  incl_championship:{tr: "Championship dahil", en: "incl. Championship" },
  home_team:       { tr: "Ev sahibi",          en: "Home" },
  away_team:       { tr: "Deplasman",          en: "Away" },
  johns_take_ready:{ tr: "John'un görüşü hazır", en: "John's take is ready" },
  read:            { tr: "Oku →",              en: "Read →" },
  back_to_matches: { tr: "Maçlara dön",        en: "Back to matches" },

  // Odds labels
  odds_home:       { tr: "Ev",         en: "Home" },
  odds_draw:       { tr: "Beraberlik", en: "Draw" },
  odds_away:       { tr: "Deplasman",  en: "Away" },
  market_consensus:{ tr: "Piyasa konsensüsü", en: "Market consensus" },

  // Analysis sections
  direct_view:     { tr: "Doğrudan görüş",      en: "Direct view" },
  why_market:      { tr: "Piyasa neden bu yönde", en: "Why the market leans here" },
  my_angle:        { tr: "Benim görüşüm",        en: "My angle" },
  if_surprise:     { tr: "Sürpriz olursa",       en: "If there's a surprise" },
  confidence:      { tr: "Güven",                en: "Confidence" },
  sources:         { tr: "Kaynaklar:",           en: "Sources:" },
  premier_analyst: { tr: "Premier League uzmanı", en: "Premier League analyst" },
  matchweek:       { tr: "Hafta 34",             en: "Matchweek 34" },
  ask_john_ph:     { tr: "John'a bir şey sor…",  en: "Ask John anything…" },

  // Packages
  packages_intro:  { tr: "Takip ettiğin liglere abone ol. Jetonlar her ay yenilenir.",
                     en: "Subscribe to leagues you follow. Tokens renew monthly." },
  free_plan:       { tr: "Ücretsiz",       en: "Free" },
  tokens_per_mo:   { tr: "jeton/ay",       en: "tokens/mo" },
  most_popular:    { tr: "EN POPÜLER",     en: "MOST POPULAR" },
  subscribe:       { tr: "Abone ol",       en: "Subscribe" },
  all_agents:      { tr: "jeton/ay · Tüm ajanlar", en: "tokens/mo · All agents" },
  fast_plus_sharp: { tr: "jeton/ay · Fast + Sharp", en: "tokens/mo · Fast + Sharp" },
  soon:            { tr: "yakında",         en: "soon" },
  topup:           { tr: "Top-up · 500 jeton", en: "Top-up · 500 tokens" },

  // Account
  free_member:     { tr: "Ücretsiz üye",        en: "Free member" },
  tokens_this_mo:  { tr: "Bu ayki jetonlar",    en: "Tokens this month" },
  upgrade_plan:    { tr: "Paket yükselt",       en: "Upgrade plan" },
  notifications:   { tr: "Bildirimler",         en: "Notifications" },
  fav_teams:       { tr: "Favori takımlar",     en: "Favourite teams" },
  help:            { tr: "Yardım",              en: "Help" },
  sign_out:        { tr: "Çıkış yap",           en: "Sign out" },
  log_in:          { tr: "Giriş yap",           en: "Log in" },
  sign_up:         { tr: "Kaydol",              en: "Sign up" },
  email:           { tr: "E-posta",             en: "Email" },
  password:        { tr: "Şifre",               en: "Password" },

  // John demo text
  john_direct:     {
    tr: "United net favori ama ezici değil. Piyasa ev galibiyetini yaklaşık %55 fiyatlıyor. Sürpriz olursa bu gece Leeds galibiyetinden çok beraberlik beklerim.",
    en: "United are a clear but not crushing home favourite. Market prices the home win around 55%. If there's a surprise tonight, expect a draw over a Leeds win.",
  },
  john_why: {
    tr: "United Old Trafford'da son 5 maçın 2'sini kazandı, maç başına 1.8 gol. Leeds deplasmanda hafif (son 2'de 0G-1B-1M), xG karşı 1.6. Bamford şüpheli, tavanı düşüyor.",
    en: "United won 2 of their last 5 at Old Trafford, 1.8 goals/game. Leeds light away (0W-1D-1L last two), 1.6 xG conceded. Bamford doubtful, ceiling trimmed.",
  },
  john_angle: {
    tr: "Ana senaryoda piyasayla aynı taraftayım. United'ın fiyatı dürüst — 1.70'in altına oynamam. Beraberlik biraz ucuz duruyor.",
    en: "I'm with the market on the base case. United's price looks fair — I wouldn't pay shorter than 1.70. The draw is slightly underpriced.",
  },
  john_upset: {
    tr: "En temiz sürpriz formu beraberlik, Leeds galibiyeti değil. United alçak bloku açmakta zorlanırsa skor 1-1 ya da 2-2'ye gider.",
    en: "The cleanest upset path is the draw, not a Leeds win. If United struggle against a low block, the scoreline tilts to 1-1 or 2-2.",
  },
  src_form:    { tr: "form (5 maç)", en: "form (5 matches)" },
  src_squad:   { tr: "kadro",        en: "availability" },

  // Mode toggle
  mode_fast:       { tr: "Hızlı",              en: "Fast" },
  mode_sharp:      { tr: "Derin analiz",       en: "Sharp" },
  mode_fast_cost:  { tr: "1 jeton",            en: "1 token" },
  mode_sharp_cost: { tr: "5 jeton · daha uzun", en: "5 tokens · longer" },

  // Password reset
  forgot_password:      { tr: "Şifremi unuttum", en: "Forgot password" },
  reset_password:       { tr: "Şifre sıfırla",   en: "Reset password" },
  reset_email_sent:     { tr: "Sıfırlama bağlantısı e-postana gönderildi.",
                          en: "Reset link sent to your email." },
  set_new_password:     { tr: "Yeni şifre belirle", en: "Set a new password" },
  password_updated:     { tr: "Şifre güncellendi.", en: "Password updated." },

  // Admin
  admin_grant_tokens:   { tr: "Jeton ver",    en: "Grant tokens" },
  admin_amount:         { tr: "Miktar",       en: "Amount" },
  admin_note:           { tr: "Not (opsiyonel)", en: "Note (optional)" },
  admin_save:           { tr: "Kaydet",       en: "Save" },
  admin_cancel:         { tr: "İptal",        en: "Cancel" },

  // Voice
  voice_hold:       { tr: "Basılı tut — konuş", en: "Hold to talk" },
  voice_recording:  { tr: "Dinliyorum…",         en: "Listening…" },
  voice_thinking:   { tr: "John düşünüyor…",     en: "John is thinking…" },
  voice_no_mic:     { tr: "Mikrofona erişilemiyor.", en: "Microphone not available." },
  voice_cost:       { tr: "3 jeton · ses ile",   en: "3 tokens · voice" },
  voice_replay:     { tr: "Tekrar oynat",        en: "Replay" },
} as const;

export type DictKey = keyof typeof DICT;

export function translate(key: DictKey, lang: Lang): string {
  return DICT[key][lang];
}
