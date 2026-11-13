# 3D Pharmacie Book 📖💊
### Leçon interactive 3D : Synthèse de la Kétamine & Atelier IA
### كتاب الصيدلة ثلاثي الأبعاد : تخليق الكيتامين وورشة الذكاء الاصطناعي

An interactive 3D pedagogical pop-up book for pharmacy students and chemistry enthusiasts, featuring molecular mechanics, skeletal formula extrusion, step-by-step synthesis animation, and an AI Studio to turn any chemical reaction into an interactive 3D lesson.

🌐 **Live Demo / الموقع أونلاين:** [https://ndtmk19-maker.github.io/3d-pharmacie-book/](https://ndtmk19-maker.github.io/3d-pharmacie-book/)  
🌐 **باللغة العربية مباشرة:** [https://ndtmk19-maker.github.io/3d-pharmacie-book/?lang=ar](https://ndtmk19-maker.github.io/3d-pharmacie-book/?lang=ar)


---

## ✨ Features / المميزات / Fonctionnalités

- 📖 **Interactive 3D Book (كتاب ثلاثي الأبعاد مجسم):** Real-time 3D rendered open textbook with realistic paper shaders, ink drawings, and page spreads powered by **Three.js** & **Postprocessing**.
- 🔬 **Ketamine Synthesis (تخليق الكيتامين):** Detailed 4-step classic synthesis mechanism (Stevens / Parke-Davis):
  1. Grignard reagent + Nitrile → Ketone
  2. $\alpha$-Bromination ($Br_2$)
  3. Reaction with methylamine ($CH_3NH_2$) → $\alpha$-hydroxy imine
  4. Thermal rearrangement → Ketamine
- 🎬 **Kinematic 3D Animations (محاكاة سينمائية للروابط والذرات):** Real-time atom tracking, bond formation/cleavage, and electron density cues ($C^*$ and $C_\alpha$).
- 🧪 **RDKit Integration:** Accurate chemical parsing and validation via `@rdkit/rdkit`.
- 🤖 **AI Studio (ورشة الذكاء الاصطناعي):** Generate brand-new 3D interactive lessons for any reaction using text input or scheme images powered by **Gemini AI**.
- 🌐 **Multilingual & RTL Support:** Fully localized in **العربية (Arabic RTL)**, **Français (French)**, and **English**.

---

## 🚀 Getting Started / طريقة التشغيل

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended)
- [pnpm](https://pnpm.io/) or `npm`

### Installation

```bash
# Clone the repository
git clone https://github.com/ndtmk19-maker/3d-pharmacie-book.git
cd 3d-pharmacie-book

# Install dependencies (using pnpm or npm)
pnpm install
# or
npm install
```

### Running Locally

```bash
# Start development server
pnpm dev
# or
npm run dev
```

Open [http://localhost:8443](http://localhost:8443) (or the port displayed in your terminal).

* To view in Arabic directly: [http://localhost:8443/?lang=ar](http://localhost:8443/?lang=ar)
* To access the AI Studio: [http://localhost:8443/#new](http://localhost:8443/#new) (or [http://localhost:8443/?lang=ar#new](http://localhost:8443/?lang=ar#new))

---

## 🔑 AI Studio Configuration (Optional)

To enable generating new lessons from the AI Studio with Gemini:

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Add your Gemini API key:
   ```env
   VITE_GEMINI_API_KEY=your_gemini_api_key_here
   ```

---

## 🛠️ Tech Stack
- **Three.js** & **Postprocessing**
- **@rdkit/rdkit**
- **React 19** & **Vite 8**
- **Tailwind CSS v4**
- **Gemini API**
