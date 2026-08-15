// Компонент с SVG паттернами для разных типов продуктов
export const ProductTypePatterns = () => {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }}>
      <defs>
        {/* Паттерн для фруктов - дольки апельсина */}
        <pattern id="pattern-fruits" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
          <circle cx="25" cy="25" r="20" fill="rgba(255, 152, 0, 0.08)" />
          <path d="M 25 5 L 25 45 M 5 25 L 45 25 M 12 12 L 38 38 M 38 12 L 12 38" stroke="rgba(255, 152, 0, 0.12)" strokeWidth="1.5" />
          <circle cx="75" cy="75" r="15" fill="rgba(255, 152, 0, 0.06)" />
          <path d="M 75 60 L 75 90 M 60 75 L 90 75" stroke="rgba(255, 152, 0, 0.1)" strokeWidth="1" />
        </pattern>

        {/* Паттерн для молока - капли и бутылка */}
        <pattern id="pattern-milk" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
          <path d="M 20 15 Q 20 8 25 8 Q 30 8 30 15 Q 30 22 25 28 Q 20 22 20 15" fill="rgba(33, 150, 243, 0.08)" />
          <rect x="55" y="20" width="15" height="25" rx="2" fill="rgba(33, 150, 243, 0.1)" />
          <rect x="58" y="18" width="9" height="3" fill="rgba(33, 150, 243, 0.1)" />
          <path d="M 10 50 Q 10 45 13 45 Q 16 45 16 50 Q 16 55 13 58 Q 10 55 10 50" fill="rgba(33, 150, 243, 0.06)" />
        </pattern>

        {/* Паттерн для газировки - бутылки */}
        <pattern id="pattern-drinks" x="0" y="0" width="90" height="90" patternUnits="userSpaceOnUse">
          <rect x="25" y="15" width="18" height="35" rx="8" fill="rgba(233, 30, 99, 0.08)" stroke="rgba(233, 30, 99, 0.15)" strokeWidth="1.5" />
          <rect x="30" y="10" width="8" height="6" fill="rgba(233, 30, 99, 0.1)" />
          <circle cx="34" cy="25" r="2" fill="rgba(255, 255, 255, 0.3)" />
          <rect x="60" y="55" width="15" height="28" rx="6" fill="rgba(233, 30, 99, 0.06)" stroke="rgba(233, 30, 99, 0.1)" strokeWidth="1" />
        </pattern>

        {/* Паттерн для хлеба - колосья и батон */}
        <pattern id="pattern-bread" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
          <ellipse cx="30" cy="40" rx="25" ry="12" fill="rgba(255, 152, 0, 0.08)" />
          <path d="M 15 40 Q 20 35 25 40 M 20 40 Q 25 35 30 40 M 25 40 Q 30 35 35 40" stroke="rgba(255, 152, 0, 0.15)" strokeWidth="1" fill="none" />
          <line x1="70" y1="70" x2="70" y2="30" stroke="rgba(255, 152, 0, 0.1)" strokeWidth="2" />
          <path d="M 70 35 L 65 38 M 70 40 L 64 43 M 70 45 L 65 48" stroke="rgba(255, 152, 0, 0.12)" strokeWidth="1.5" />
          <path d="M 70 35 L 75 38 M 70 40 L 76 43 M 70 45 L 75 48" stroke="rgba(255, 152, 0, 0.12)" strokeWidth="1.5" />
        </pattern>

        {/* Паттерн для курицы/птицы - куриная ножка */}
        <pattern id="pattern-chicken" x="0" y="0" width="95" height="95" patternUnits="userSpaceOnUse">
          {/* Куриная ножка большая */}
          <ellipse cx="30" cy="35" rx="12" ry="18" fill="rgba(255, 167, 38, 0.12)" transform="rotate(-25 30 35)" />
          <rect x="24" y="48" width="12" height="8" rx="2" fill="rgba(255, 167, 38, 0.14)" />
          <circle cx="30" cy="56" r="4" fill="rgba(255, 167, 38, 0.1)" />
          <path d="M 27 56 L 25 62 M 30 56 L 30 63 M 33 56 L 35 62" stroke="rgba(255, 167, 38, 0.15)" strokeWidth="1.5" strokeLinecap="round" />
          
          {/* Куриная ножка маленькая */}
          <ellipse cx="65" cy="60" rx="9" ry="13" fill="rgba(255, 167, 38, 0.1)" transform="rotate(15 65 60)" />
          <rect x="61" y="70" width="8" height="6" rx="1.5" fill="rgba(255, 167, 38, 0.12)" />
          <circle cx="65" cy="76" r="3" fill="rgba(255, 167, 38, 0.08)" />
          <path d="M 63 76 L 62 80 M 65 76 L 65 81 M 67 76 L 68 80" stroke="rgba(255, 167, 38, 0.12)" strokeWidth="1" strokeLinecap="round" />
          
          {/* Декоративные элементы - перышки */}
          <path d="M 20 65 Q 18 68 20 71" stroke="rgba(255, 167, 38, 0.1)" strokeWidth="1.5" fill="none" />
          <path d="M 75 25 Q 73 28 75 31" stroke="rgba(255, 167, 38, 0.08)" strokeWidth="1" fill="none" />
        </pattern>

        {/* Паттерн для мяса - абстрактный паттерн */}
        <pattern id="pattern-meat" x="0" y="0" width="90" height="90" patternUnits="userSpaceOnUse">
          <path d="M 20 25 Q 30 20 40 25 Q 45 30 40 40 Q 30 45 20 40 Q 15 35 20 25" fill="rgba(211, 47, 47, 0.08)" />
          <circle cx="30" cy="30" r="3" fill="rgba(255, 255, 255, 0.15)" />
          <path d="M 60 60 Q 68 58 73 63 Q 75 70 70 75 Q 63 77 58 72 Q 56 65 60 60" fill="rgba(211, 47, 47, 0.06)" />
        </pattern>

        {/* Паттерн для овощей - листья */}
        <pattern id="pattern-vegetables" x="0" y="0" width="85" height="85" patternUnits="userSpaceOnUse">
          <path d="M 25 40 Q 25 25 35 20 Q 40 25 35 40 Q 30 42 25 40" fill="rgba(76, 175, 80, 0.1)" />
          <path d="M 25 40 L 35 20" stroke="rgba(76, 175, 80, 0.15)" strokeWidth="1" />
          <path d="M 60 65 Q 60 55 67 52 Q 70 56 67 65 Q 63 67 60 65" fill="rgba(76, 175, 80, 0.08)" />
          <circle cx="20" cy="65" r="8" fill="rgba(76, 175, 80, 0.06)" />
        </pattern>

        {/* Паттерн для химии - пузыри и спрей */}
        <pattern id="pattern-chemicals" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
          <circle cx="25" cy="25" r="12" fill="none" stroke="rgba(156, 39, 176, 0.12)" strokeWidth="1.5" />
          <circle cx="25" cy="25" r="7" fill="none" stroke="rgba(156, 39, 176, 0.1)" strokeWidth="1" />
          <circle cx="60" cy="50" r="8" fill="none" stroke="rgba(156, 39, 176, 0.08)" strokeWidth="1" />
          <circle cx="75" cy="30" r="6" fill="none" stroke="rgba(156, 39, 176, 0.1)" strokeWidth="1" />
          <circle cx="35" cy="65" r="10" fill="none" stroke="rgba(156, 39, 176, 0.09)" strokeWidth="1.5" />
          <rect x="15" y="75" width="8" height="15" rx="1" fill="rgba(156, 39, 176, 0.08)" />
          <path d="M 19 73 L 16 68 M 19 73 L 22 68" stroke="rgba(156, 39, 176, 0.12)" strokeWidth="1" />
        </pattern>

        {/* Паттерн для средств гигиены - зубная щетка и т.д. */}
        <pattern id="pattern-hygiene" x="0" y="0" width="95" height="95" patternUnits="userSpaceOnUse">
          <rect x="20" y="20" width="6" height="30" rx="3" fill="rgba(0, 188, 212, 0.1)" />
          <ellipse cx="23" cy="18" rx="4" ry="6" fill="rgba(0, 188, 212, 0.12)" />
          <line x1="23" y1="50" x2="23" y2="60" stroke="rgba(0, 188, 212, 0.08)" strokeWidth="1.5" />
          <circle cx="60" cy="55" r="15" fill="none" stroke="rgba(0, 188, 212, 0.1)" strokeWidth="1.5" />
          <path d="M 60 45 Q 55 50 60 55 Q 65 50 60 45" fill="rgba(0, 188, 212, 0.08)" />
          <rect x="70" y="25" width="12" height="8" rx="2" fill="rgba(0, 188, 212, 0.09)" />
        </pattern>

        {/* Паттерн для сладостей - конфеты */}
        <pattern id="pattern-sweets" x="0" y="0" width="90" height="90" patternUnits="userSpaceOnUse">
          <rect x="20" y="25" width="20" height="12" rx="2" fill="rgba(233, 30, 99, 0.1)" />
          <path d="M 20 31 L 15 31 Q 12 31 12 28 Q 12 25 15 25 L 20 25" fill="rgba(233, 30, 99, 0.12)" />
          <path d="M 40 31 L 45 31 Q 48 31 48 28 Q 48 25 45 25 L 40 25" fill="rgba(233, 30, 99, 0.12)" />
          <circle cx="65" cy="60" r="8" fill="rgba(233, 30, 99, 0.08)" />
          <path d="M 65 54 L 65 50 M 60 60 L 56 60" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="1.5" />
        </pattern>

        {/* Паттерн для яиц */}
        <pattern id="pattern-eggs" x="0" y="0" width="85" height="85" patternUnits="userSpaceOnUse">
          <ellipse cx="30" cy="35" rx="12" ry="16" fill="rgba(255, 235, 59, 0.12)" stroke="rgba(255, 235, 59, 0.2)" strokeWidth="1.5" />
          <ellipse cx="60" cy="60" rx="10" ry="13" fill="rgba(255, 235, 59, 0.1)" stroke="rgba(255, 235, 59, 0.18)" strokeWidth="1" />
          <ellipse cx="25" cy="70" rx="8" ry="11" fill="rgba(255, 235, 59, 0.08)" stroke="rgba(255, 235, 59, 0.15)" strokeWidth="1" />
        </pattern>

        {/* Паттерн для рыбы */}
        <pattern id="pattern-fish" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
          <ellipse cx="35" cy="40" rx="18" ry="10" fill="rgba(3, 169, 244, 0.1)" />
          <path d="M 17 40 L 10 35 L 10 45 Z" fill="rgba(3, 169, 244, 0.12)" />
          <path d="M 53 40 L 58 38 L 58 42 Z" fill="rgba(3, 169, 244, 0.12)" />
          <circle cx="45" cy="38" r="2" fill="rgba(0, 0, 0, 0.15)" />
          <path d="M 25 40 L 45 40 M 30 38 L 30 42 M 35 38 L 35 42 M 40 38 L 40 42" stroke="rgba(3, 169, 244, 0.15)" strokeWidth="0.5" />
        </pattern>

        {/* Паттерн для кофе/чая */}
        <pattern id="pattern-coffee" x="0" y="0" width="90" height="90" patternUnits="userSpaceOnUse">
          <rect x="22" y="30" width="20" height="18" rx="2" fill="rgba(121, 85, 72, 0.1)" />
          <path d="M 42 35 Q 48 35 48 40 Q 48 45 42 45" stroke="rgba(121, 85, 72, 0.15)" strokeWidth="1.5" fill="none" />
          <path d="M 28 20 Q 28 15 32 20" stroke="rgba(121, 85, 72, 0.2)" strokeWidth="1" fill="none" />
          <path d="M 36 20 Q 36 15 40 20" stroke="rgba(121, 85, 72, 0.2)" strokeWidth="1" fill="none" />
          <circle cx="65" cy="60" r="8" fill="rgba(121, 85, 72, 0.08)" />
        </pattern>

        {/* Паттерн для сыра */}
        <pattern id="pattern-cheese" x="0" y="0" width="95" height="95" patternUnits="userSpaceOnUse">
          <path d="M 20 30 L 50 30 L 45 50 L 25 50 Z" fill="rgba(255, 193, 7, 0.12)" stroke="rgba(255, 193, 7, 0.2)" strokeWidth="1.5" />
          <circle cx="30" cy="38" r="3" fill="rgba(255, 255, 255, 0.3)" />
          <circle cx="40" cy="42" r="4" fill="rgba(255, 255, 255, 0.3)" />
          <circle cx="33" cy="45" r="2.5" fill="rgba(255, 255, 255, 0.3)" />
          <circle cx="65" cy="65" r="6" fill="rgba(255, 193, 7, 0.08)" />
        </pattern>

        {/* Паттерн для закусок/чипсов */}
        <pattern id="pattern-snacks" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
          <rect x="20" y="20" width="25" height="35" rx="2" fill="rgba(255, 87, 34, 0.08)" stroke="rgba(255, 87, 34, 0.15)" strokeWidth="1.5" />
          <path d="M 25 25 L 40 25 M 25 30 L 38 30 M 27 35 L 40 35" stroke="rgba(255, 87, 34, 0.12)" strokeWidth="1" />
          <ellipse cx="65" cy="60" rx="12" ry="8" fill="rgba(255, 87, 34, 0.1)" transform="rotate(-20 65 60)" />
        </pattern>

        {/* Универсальный паттерн для неопределенных типов */}
        <pattern id="pattern-default" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
          <circle cx="20" cy="20" r="3" fill="rgba(158, 158, 158, 0.1)" />
          <circle cx="60" cy="20" r="3" fill="rgba(158, 158, 158, 0.08)" />
          <circle cx="20" cy="60" r="3" fill="rgba(158, 158, 158, 0.08)" />
          <circle cx="60" cy="60" r="3" fill="rgba(158, 158, 158, 0.1)" />
          <circle cx="40" cy="40" r="4" fill="rgba(158, 158, 158, 0.12)" />
        </pattern>

        {/* Паттерн для соусов */}
        <pattern id="pattern-sauces" x="0" y="0" width="90" height="90" patternUnits="userSpaceOnUse">
          <path d="M 30 20 L 30 50 Q 30 55 35 55 L 45 55 Q 50 55 50 50 L 50 20 Q 50 18 48 18 L 32 18 Q 30 18 30 20" fill="rgba(205, 220, 57, 0.1)" stroke="rgba(205, 220, 57, 0.15)" strokeWidth="1.5" />
          <circle cx="40" cy="15" r="3" fill="rgba(205, 220, 57, 0.12)" />
          <path d="M 35 30 Q 40 35 45 30" stroke="rgba(205, 220, 57, 0.2)" strokeWidth="1.5" fill="none" />
        </pattern>

        {/* Паттерн для заморозки/мороженое */}
        <pattern id="pattern-frozen" x="0" y="0" width="95" height="95" patternUnits="userSpaceOnUse">
          <path d="M 40 20 L 40 50 M 25 28 L 55 42 M 25 42 L 55 28" stroke="rgba(129, 212, 250, 0.15)" strokeWidth="1.5" />
          <circle cx="40" cy="35" r="2" fill="rgba(129, 212, 250, 0.2)" />
          <path d="M 30 60 Q 30 55 35 55 L 35 70 Q 35 75 40 75 Q 45 75 45 70 L 45 55 Q 50 55 50 60 L 50 65" stroke="rgba(129, 212, 250, 0.12)" strokeWidth="1.5" fill="none" />
        </pattern>

        {/* Паттерн для масла */}
        <pattern id="pattern-oil" x="0" y="0" width="85" height="85" patternUnits="userSpaceOnUse">
          <rect x="25" y="20" width="15" height="30" rx="2" fill="rgba(255, 235, 59, 0.1)" stroke="rgba(255, 235, 59, 0.18)" strokeWidth="1.5" />
          <rect x="28" y="16" width="9" height="5" rx="1" fill="rgba(255, 235, 59, 0.12)" />
          <path d="M 32 28 Q 30 32 32 36" stroke="rgba(255, 235, 59, 0.25)" strokeWidth="1.5" fill="none" />
          <circle cx="60" cy="60" r="8" fill="rgba(255, 235, 59, 0.08)" />
        </pattern>

        {/* Символы для одиночных иконок */}
        <symbol id="icon-fruits" viewBox="0 0 60 60">
          <circle cx="30" cy="30" r="24" fill="rgba(255, 152, 0, 0.15)" />
          <path d="M 30 6 L 30 54 M 6 30 L 54 30 M 12 12 L 48 48 M 48 12 L 12 48" stroke="rgba(255, 152, 0, 0.3)" strokeWidth="2.5" />
        </symbol>

        <symbol id="icon-milk" viewBox="0 0 60 60">
          <rect x="18" y="15" width="24" height="35" rx="3" fill="rgba(33, 150, 243, 0.2)" />
          <rect x="22" y="10" width="16" height="6" fill="rgba(33, 150, 243, 0.2)" />
          <path d="M 25 25 Q 25 20 30 20 Q 35 20 35 25 Q 35 30 30 35 Q 25 30 25 25" fill="rgba(33, 150, 243, 0.15)" />
        </symbol>

        <symbol id="icon-drinks" viewBox="0 0 60 60">
          <rect x="20" y="12" width="20" height="40" rx="10" fill="rgba(233, 30, 99, 0.15)" stroke="rgba(233, 30, 99, 0.3)" strokeWidth="2" />
          <rect x="25" y="7" width="10" height="6" fill="rgba(233, 30, 99, 0.2)" />
          <circle cx="30" cy="22" r="3" fill="rgba(255, 255, 255, 0.4)" />
        </symbol>

        <symbol id="icon-bread" viewBox="0 0 60 60">
          <ellipse cx="30" cy="35" rx="22" ry="12" fill="rgba(255, 152, 0, 0.2)" />
          <path d="M 15 35 Q 20 28 25 35 M 22 35 Q 27 28 32 35 M 28 35 Q 33 28 38 35 M 35 35 Q 40 28 45 35" stroke="rgba(255, 152, 0, 0.35)" strokeWidth="1.5" fill="none" />
        </symbol>

        <symbol id="icon-chicken" viewBox="0 0 60 60">
          <ellipse cx="30" cy="25" rx="14" ry="20" fill="rgba(255, 167, 38, 0.25)" transform="rotate(-25 30 25)" />
          <rect x="23" y="42" width="14" height="10" rx="3" fill="rgba(255, 167, 38, 0.28)" />
          <circle cx="30" cy="52" r="5" fill="rgba(255, 167, 38, 0.2)" />
          <path d="M 26 52 L 23 58 M 30 52 L 30 59 M 34 52 L 37 58" stroke="rgba(255, 167, 38, 0.35)" strokeWidth="2" strokeLinecap="round" />
        </symbol>

        <symbol id="icon-meat" viewBox="0 0 60 60">
          <path d="M 15 20 Q 30 15 45 20 Q 50 30 45 45 Q 30 50 15 45 Q 10 30 15 20" fill="rgba(211, 47, 47, 0.2)" />
          <circle cx="30" cy="30" r="4" fill="rgba(255, 255, 255, 0.25)" />
          <circle cx="22" cy="28" r="3" fill="rgba(255, 255, 255, 0.2)" />
          <circle cx="38" cy="35" r="3" fill="rgba(255, 255, 255, 0.2)" />
        </symbol>

        <symbol id="icon-vegetables" viewBox="0 0 60 60">
          <path d="M 20 35 Q 20 15 35 10 Q 42 17 35 35 Q 27 40 20 35" fill="rgba(76, 175, 80, 0.25)" />
          <path d="M 20 35 L 35 10" stroke="rgba(76, 175, 80, 0.35)" strokeWidth="2" />
          <circle cx="15" cy="45" r="10" fill="rgba(76, 175, 80, 0.2)" />
        </symbol>

        <symbol id="icon-chemicals" viewBox="0 0 60 60">
          <circle cx="30" cy="30" r="15" fill="none" stroke="rgba(156, 39, 176, 0.25)" strokeWidth="2.5" />
          <circle cx="30" cy="30" r="9" fill="none" stroke="rgba(156, 39, 176, 0.2)" strokeWidth="2" />
          <rect x="20" y="48" width="10" height="18" rx="2" fill="rgba(156, 39, 176, 0.2)" />
          <path d="M 25 46 L 21 40 M 25 46 L 29 40" stroke="rgba(156, 39, 176, 0.3)" strokeWidth="2" />
        </symbol>

        <symbol id="icon-hygiene" viewBox="0 0 60 60">
          <rect x="24" y="15" width="8" height="35" rx="4" fill="rgba(0, 188, 212, 0.25)" />
          <ellipse cx="28" cy="12" rx="5" ry="7" fill="rgba(0, 188, 212, 0.3)" />
          <circle cx="42" cy="40" r="15" fill="none" stroke="rgba(0, 188, 212, 0.25)" strokeWidth="2.5" />
          <path d="M 42 30 Q 36 35 42 40 Q 48 35 42 30" fill="rgba(0, 188, 212, 0.2)" />
        </symbol>

        <symbol id="icon-sweets" viewBox="0 0 60 60">
          <rect x="20" y="25" width="25" height="15" rx="3" fill="rgba(233, 30, 99, 0.25)" />
          <path d="M 20 32.5 L 12 32.5 Q 8 32.5 8 29 Q 8 25.5 12 25.5 L 20 25.5" fill="rgba(233, 30, 99, 0.3)" />
          <path d="M 45 32.5 L 53 32.5 Q 57 32.5 57 29 Q 57 25.5 53 25.5 L 45 25.5" fill="rgba(233, 30, 99, 0.3)" />
          <circle cx="42" cy="48" r="8" fill="rgba(233, 30, 99, 0.2)" />
        </symbol>

        <symbol id="icon-eggs" viewBox="0 0 60 60">
          <ellipse cx="30" cy="30" rx="14" ry="20" fill="rgba(255, 235, 59, 0.25)" stroke="rgba(255, 235, 59, 0.4)" strokeWidth="2" />
          <ellipse cx="20" cy="45" rx="8" ry="12" fill="rgba(255, 235, 59, 0.2)" stroke="rgba(255, 235, 59, 0.35)" strokeWidth="1.5" />
        </symbol>

        <symbol id="icon-fish" viewBox="0 0 60 60">
          <ellipse cx="30" cy="30" rx="22" ry="12" fill="rgba(3, 169, 244, 0.25)" />
          <path d="M 8 30 L 0 24 L 0 36 Z" fill="rgba(3, 169, 244, 0.3)" />
          <path d="M 52 30 L 58 28 L 58 32 Z" fill="rgba(3, 169, 244, 0.3)" />
          <circle cx="45" cy="27" r="3" fill="rgba(0, 0, 0, 0.25)" />
          <path d="M 18 30 L 42 30 M 23 27 L 23 33 M 30 27 L 30 33 M 37 27 L 37 33" stroke="rgba(3, 169, 244, 0.35)" strokeWidth="1" />
        </symbol>

        <symbol id="icon-coffee" viewBox="0 0 60 60">
          <rect x="18" y="25" width="25" height="22" rx="3" fill="rgba(121, 85, 72, 0.25)" />
          <path d="M 43 30 Q 51 30 51 38 Q 51 46 43 46" stroke="rgba(121, 85, 72, 0.35)" strokeWidth="2.5" fill="none" />
          <path d="M 24 15 Q 24 8 30 15" stroke="rgba(121, 85, 72, 0.4)" strokeWidth="2" fill="none" />
          <path d="M 36 15 Q 36 8 42 15" stroke="rgba(121, 85, 72, 0.4)" strokeWidth="2" fill="none" />
        </symbol>

        <symbol id="icon-cheese" viewBox="0 0 60 60">
          <path d="M 15 20 L 50 20 L 43 45 L 22 45 Z" fill="rgba(255, 193, 7, 0.25)" stroke="rgba(255, 193, 7, 0.4)" strokeWidth="2.5" />
          <circle cx="27" cy="30" r="4" fill="rgba(255, 255, 255, 0.4)" />
          <circle cx="38" cy="34" r="5" fill="rgba(255, 255, 255, 0.4)" />
          <circle cx="30" cy="38" r="3.5" fill="rgba(255, 255, 255, 0.4)" />
        </symbol>

        <symbol id="icon-snacks" viewBox="0 0 60 60">
          <rect x="18" y="12" width="28" height="40" rx="3" fill="rgba(255, 87, 34, 0.2)" stroke="rgba(255, 87, 34, 0.35)" strokeWidth="2.5" />
          <path d="M 22 18 L 42 18 M 22 25 L 40 25 M 24 32 L 42 32" stroke="rgba(255, 87, 34, 0.3)" strokeWidth="2" />
          <ellipse cx="42" cy="48" rx="14" ry="9" fill="rgba(255, 87, 34, 0.25)" transform="rotate(-20 42 48)" />
        </symbol>

        <symbol id="icon-sauces" viewBox="0 0 60 60">
          <path d="M 25 12 L 25 45 Q 25 50 30 50 L 40 50 Q 45 50 45 45 L 45 12 Q 45 10 43 10 L 27 10 Q 25 10 25 12" fill="rgba(205, 220, 57, 0.25)" stroke="rgba(205, 220, 57, 0.35)" strokeWidth="2.5" />
          <circle cx="35" cy="7" r="4" fill="rgba(205, 220, 57, 0.3)" />
          <path d="M 30 28 Q 35 35 40 28" stroke="rgba(205, 220, 57, 0.45)" strokeWidth="2.5" fill="none" />
        </symbol>

        <symbol id="icon-frozen" viewBox="0 0 60 60">
          <path d="M 30 10 L 30 50 M 12 22 L 48 38 M 12 38 L 48 22" stroke="rgba(129, 212, 250, 0.35)" strokeWidth="2.5" />
          <circle cx="30" cy="30" r="3" fill="rgba(129, 212, 250, 0.4)" />
          <path d="M 22 48 Q 22 42 28 42 L 28 58 Q 28 64 35 64 Q 42 64 42 58 L 42 42 Q 48 42 48 48 L 48 54" stroke="rgba(129, 212, 250, 0.3)" strokeWidth="2.5" fill="none" />
        </symbol>

        <symbol id="icon-oil" viewBox="0 0 60 60">
          <rect x="22" y="15" width="18" height="35" rx="3" fill="rgba(255, 235, 59, 0.25)" stroke="rgba(255, 235, 59, 0.4)" strokeWidth="2.5" />
          <rect x="26" y="10" width="10" height="6" rx="2" fill="rgba(255, 235, 59, 0.3)" />
          <path d="M 31 25 Q 28 30 31 35" stroke="rgba(255, 235, 59, 0.5)" strokeWidth="2.5" fill="none" />
        </symbol>

        <symbol id="icon-default" viewBox="0 0 60 60">
          <circle cx="30" cy="30" r="18" fill="rgba(158, 158, 158, 0.2)" />
          <circle cx="20" cy="20" r="5" fill="rgba(158, 158, 158, 0.25)" />
          <circle cx="40" cy="40" r="5" fill="rgba(158, 158, 158, 0.25)" />
        </symbol>
      </defs>
    </svg>
  );
};

// Функция для определения паттерна по типу продукта
export const getPatternForProductType = (productType: string): string => {
  const type = productType.toLowerCase();
  
  // Фрукты и ягоды
  if (type.includes('фрукт') || type.includes('яблок') || type.includes('банан') || 
      type.includes('апельсин') || type.includes('мандарин') || type.includes('груш') ||
      type.includes('ягод') || type.includes('клубник') || type.includes('виноград') ||
      type.includes('киви') || type.includes('лимон') || type.includes('грейпфрут')) {
    return 'icon-fruits';
  }
  
  // Молоко и молочные продукты
  if (type.includes('молок') || type.includes('кефир') || type.includes('йогурт') ||
      type.includes('сметан') || type.includes('творог') || type.includes('ряженк') ||
      type.includes('простоквашин')) {
    return 'icon-milk';
  }
  
  // Напитки (газировка, соки)
  if (type.includes('газировк') || type.includes('сок') || type.includes('напиток') ||
      type.includes('кола') || type.includes('пепси') || type.includes('спрайт') ||
      type.includes('фанта') || type.includes('лимонад')) {
    return 'icon-drinks';
  }
  
  // Хлеб и выпечка
  if (type.includes('хлеб') || type.includes('батон') || type.includes('булк') ||
      type.includes('выпечк') || type.includes('пирог') || type.includes('круассан') ||
      type.includes('багет') || type.includes('лаваш')) {
    return 'icon-bread';
  }
  
  // Курица и птица (ВАЖНО: проверяем ДО мяса!)
  if (type.includes('курица') || type.includes('курин') || type.includes('птиц') ||
      type.includes('цыпл') || type.includes('индейк') || type.includes('утк') ||
      type.includes('гус')) {
    return 'icon-chicken';
  }
  
  // Мясо и колбасы
  if (type.includes('мяс') || type.includes('говяд') || type.includes('свинин') ||
      type.includes('колбас') || type.includes('сосиск') || type.includes('ветчин') || 
      type.includes('бекон') || type.includes('фарш')) {
    return 'icon-meat';
  }
  
  // Овощи
  if (type.includes('овощ') || type.includes('морков') || type.includes('картофел') ||
      type.includes('помидор') || type.includes('огурец') || type.includes('капуст') ||
      type.includes('лук') || type.includes('перец') || type.includes('салат') ||
      type.includes('зелен')) {
    return 'icon-vegetables';
  }
  
  // Бытовая химия
  if (type.includes('хими') || type.includes('моющ') || type.includes('стиральн') ||
      type.includes('порошок') || type.includes('отбеливател') || type.includes('чист') ||
      type.includes('средство для посуд') || type.includes('мыл')) {
    return 'icon-chemicals';
  }
  
  // Средства гигиены
  if (type.includes('гигиен') || type.includes('тампон') || type.includes('прокладк') ||
      type.includes('зубн') || type.includes('шампун') || type.includes('гель для душ') ||
      type.includes('дезодорант') || type.includes('мыл') || type.includes('салфетк') ||
      type.includes('туалетн') || type.includes('бумаг')) {
    return 'icon-hygiene';
  }
  
  // Сладости
  if (type.includes('сладк') || type.includes('конфет') || type.includes('шоколад') ||
      type.includes('печень') || type.includes('вафл') || type.includes('торт') ||
      type.includes('пирожн') || type.includes('зефир') || type.includes('мармелад')) {
    return 'icon-sweets';
  }
  
  // Яйца
  if (type.includes('яйц') || type.includes('яичн')) {
    return 'icon-eggs';
  }
  
  // Рыба и морепродукты
  if (type.includes('рыб') || type.includes('семг') || type.includes('лосос') ||
      type.includes('треск') || type.includes('морепродукт') || type.includes('креветк') ||
      type.includes('краб')) {
    return 'icon-fish';
  }
  
  // Кофе и чай
  if (type.includes('кофе') || type.includes('чай') || type.includes('какао')) {
    return 'icon-coffee';
  }
  
  // Сыр
  if (type.includes('сыр')) {
    return 'icon-cheese';
  }
  
  // Закуски (чипсы, снеки)
  if (type.includes('чипс') || type.includes('снек') || type.includes('сухарик') ||
      type.includes('крекер') || type.includes('попкорн') || type.includes('орех') ||
      type.includes('семечк')) {
    return 'icon-snacks';
  }
  
  // Соусы и приправы
  if (type.includes('соус') || type.includes('кетчуп') || type.includes('майонез') ||
      type.includes('горчиц') || type.includes('приправ') || type.includes('специ')) {
    return 'icon-sauces';
  }
  
  // Замороженные продукты
  if (type.includes('мороженое') || type.includes('заморож') || type.includes('лед')) {
    return 'icon-frozen';
  }
  
  // Масло
  if (type.includes('масло') && !type.includes('сливочн')) {
    return 'icon-oil';
  }
  
  // По умолчанию
  return 'icon-default';
};

// Функция для получения цветовой схемы в зависимости от статуса
export const getColorScheme = (status: 'ending-soon' | 'ok' | 'calculating' | 'irregular') => {
  switch (status) {
    case 'ending-soon':
      return {
        border: 'border-orange-300',
        gradientStart: 'rgba(255, 237, 213, 1)',
        gradientEnd: 'rgba(255, 224, 178, 1)'
      };
    case 'ok':
      return {
        border: 'border-green-300',
        gradientStart: 'rgba(232, 245, 233, 1)',
        gradientEnd: 'rgba(200, 230, 201, 1)'
      };
    case 'calculating':
      return {
        border: 'border-blue-300',
        gradientStart: 'rgba(227, 242, 253, 1)',
        gradientEnd: 'rgba(187, 222, 251, 1)'
      };
    case 'irregular':
      return {
        border: 'border-slate-300',
        gradientStart: 'rgba(241, 245, 249, 1)',
        gradientEnd: 'rgba(226, 232, 240, 1)'
      };
  }
};

// Функция для получения иконки для типа продукта
export const getProductTypeIcon = (productType: string): string => {
  const type = productType.toLowerCase();
  
  // Фрукты и ягоды
  if (type.includes('фрукт') || type.includes('яблок') || type.includes('банан') || 
      type.includes('апельсин') || type.includes('мандарин') || type.includes('груш') ||
      type.includes('ягод') || type.includes('клубник') || type.includes('виноград') ||
      type.includes('киви') || type.includes('лимон') || type.includes('грейпфрут') ||
      type.includes('вишн') || type.includes('черешн') || type.includes('персик') ||
      type.includes('абрикос') || type.includes('слив') || type.includes('арбуз') ||
      type.includes('дын')) {
    return '🍎';
  }
  
  // Молоко и молочные продукты
  if (type.includes('молок') || type.includes('кефир') || type.includes('йогурт') ||
      type.includes('сметан') || type.includes('творог') || type.includes('ряженк') ||
      type.includes('простоквашин')) {
    return '🥛';
  }
  
  // Напитки (газировка, соки)
  if (type.includes('газировк') || type.includes('сок') || type.includes('напиток') ||
      type.includes('кола') || type.includes('пепси') || type.includes('спрайт') ||
      type.includes('фанта') || type.includes('лимонад')) {
    return '🥤';
  }
  
  // Хлеб и выпечка
  if (type.includes('хлеб') || type.includes('батон') || type.includes('булк') ||
      type.includes('выпечк') || type.includes('пирог') || type.includes('круассан') ||
      type.includes('багет') || type.includes('лаваш') || type.includes('торт') ||
      type.includes('кекс') || type.includes('булочк')) {
    return '🍞';
  }
  
  // Курица и птица (ВАЖНО: проверяем ДО мяса!)
  if (type.includes('курица') || type.includes('курин') || type.includes('птиц') ||
      type.includes('цыпл') || type.includes('индейк') || type.includes('утк') ||
      type.includes('гус')) {
    return '🍗';
  }
  
  // Мясо и колбасы
  if (type.includes('мяс') || type.includes('говяд') || type.includes('свинин') ||
      type.includes('колбас') || type.includes('сосиск') || type.includes('ветчин') || 
      type.includes('бекон') || type.includes('фарш')) {
    return '🥩';
  }
  
  // Овощи
  if (type.includes('овощ') || type.includes('морков') || type.includes('картофел') ||
      type.includes('помидор') || type.includes('огурец') || type.includes('капуст') ||
      type.includes('лук') || type.includes('перец') || type.includes('салат') ||
      type.includes('зелен') || type.includes('брокколи') || type.includes('баклажан') ||
      type.includes('кабачок') || type.includes('тыкв') || type.includes('свекл') ||
      type.includes('редис') || type.includes('редьк')) {
    return '🥬';
  }
  
  // Бытовая химия
  if (type.includes('хими') || type.includes('моющ') || type.includes('стиральн') ||
      type.includes('порошок') || type.includes('отбеливател') || type.includes('чист') ||
      type.includes('средство для посуд')) {
    return '🧴';
  }
  
  // Средства гигиены
  if (type.includes('гигиен') || type.includes('тампон') || type.includes('прокладк') ||
      type.includes('зубн') || type.includes('шампун') || type.includes('гель для душ') ||
      type.includes('дезодорант') || type.includes('мыл') || type.includes('салфетк') ||
      type.includes('туалетн') || type.includes('бумаг')) {
    return '🧻';
  }
  
  // Сладости
  if (type.includes('сладк') || type.includes('конфет') || type.includes('шоколад') ||
      type.includes('печень') || type.includes('вафл') || type.includes('пирожн') ||
      type.includes('зефир') || type.includes('мармелад')) {
    return '🍬';
  }
  
  // Яйца
  if (type.includes('яйц') || type.includes('яичн')) {
    return '🥚';
  }
  
  // Рыба и морепродукты
  if (type.includes('рыб') || type.includes('семг') || type.includes('лосос') ||
      type.includes('треск') || type.includes('морепродукт') || type.includes('креветк') ||
      type.includes('краб')) {
    return '🐟';
  }
  
  // Кофе и чай
  if (type.includes('кофе') || type.includes('чай') || type.includes('какао')) {
    return '☕';
  }
  
  // Сыр
  if (type.includes('сыр')) {
    return '🧀';
  }
  
  // Закуски (чипсы, снеки)
  if (type.includes('чипс') || type.includes('снек') || type.includes('сухарик') ||
      type.includes('крекер') || type.includes('попкорн') || type.includes('орех') ||
      type.includes('семечк')) {
    return '🍿';
  }
  
  // Соусы и приправы
  if (type.includes('соус') || type.includes('кетчуп') || type.includes('майонез') ||
      type.includes('горчиц') || type.includes('приправ') || type.includes('специ')) {
    return '🍯';
  }
  
  // Замороженные продукты / мороженое
  if (type.includes('мороженое') || type.includes('заморож') || type.includes('лед')) {
    return '🍦';
  }
  
  // Масло
  if (type.includes('масло') && !type.includes('сливочн')) {
    return '🫒';
  }
  
  // Пицца
  if (type.includes('пицц')) {
    return '🍕';
  }
  
  // Гамбургер
  if (type.includes('бургер') || type.includes('гамбургер')) {
    return '🍔';
  }
  
  // Грибы
  if (type.includes('гриб')) {
    return '🍄';
  }
  
  // По умолчанию
  return '🛒';
};

