# HTML Overlay Editor

Visual WYSIWYG editor for creating HTML/CSS graphics overlays for **Unreal Engine** Browser Source / Web Browser widgets.

## Features

- DOM-based canvas (1920×1080 default) with pan, zoom, grid, guides, and snap
- Elements: text, image, GIF, video, SVG
- Moveable + Selecto: drag, resize, rotate, multi-select
- Layers panel, properties panel, assets browser
- Undo/redo (50 steps), keyboard shortcuts
- Auto-save to local `projects/` folder with `project.json` + generated `index.html` / `styles.css`
- Live preview with WebSocket hot reload for UE

## Requirements

- Node.js 20+

## Setup



# HTML Overlay Editor

Визуальный WYSIWYG редактор для создания HTML/CSS графических оверлей для **Unreal Engine** Browser Source / Web Browser виджетов.

## Функции

- DOM-based холст (по умолчанию 1920×1080) с панорамированием, масштабированием, сетью, линиями и прилипанием
- Элементы: текст, изображение, GIF, видео, SVG
- Перетаскивание + Выбор: перетаскивание, изменение размера, вращение, многoseleция
- Панель слоев, панель свойств, браузер ресурсов
- Отмена/повтор (50 шагов), горячие клавиши
- Автосохранение в локальную папку `projects/` с файлом `project.json` + генерированными файлами `index.html` / `styles.css`
- Превью в режиме реального времени с автоматическим обновлением для UE

## Требования

- Node.js 20+

## Установка
npm run dev
```

- **Editor:** http://localhost:5173
- **UE preview:** http://localhost:3000/preview/{projectId}/

Point your Unreal Web Browser widget at the preview URL; changes sync automatically.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start API server and Vite dev client |
| `npm run build` | Build shared, server, and client |
| `npm start` | Run production server |

## Project layout

Each project lives in `projects/{uuid}/`:

- `project.json` — editor source of truth
- `index.html`, `styles.css` — auto-generated for UE
- `assets/` — images, videos, SVG
