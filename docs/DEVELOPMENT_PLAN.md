# Overlay Editor - Development Plan


# Общий план разработки


Проект разрабатывается поэтапно.

Каждый этап должен создавать рабочий результат.

Не переходить к следующему этапу без стабильной основы предыдущего.


---

# Phase 0 — Подготовка проекта


## Цель

Создать базовую структуру.


## Задачи


Frontend:

- React;
- TypeScript;
- Vite;
- ESLint;
- Zustand.


Backend:

- Node.js;
- Express;
- WebSocket.


Создать:

```
frontend/
backend/
projects/
docs/
```


Результат:

Рабочая структура проекта.


---

# Phase 1 — Project Core


## Цель

Создать внутреннюю модель проекта.


## Задачи


Создать:


```
types/project.ts
```


Реализовать:


Project:

- id;
- название;
- размер холста;
- список объектов;
- список ресурсов.


Object:

- id;
- type;
- position;
- size;
- rotation;
- styles.


Asset:

- id;
- type;
- путь;
- метаданные.


Результат:

Есть единая модель данных редактора.


---

# Phase 2 — Canvas System


## Цель

Создать рабочий холст.


Добавить:


- отображение 1920x1080;
- масштабирование;
- панорамирование;
- фон;
- сетку.


Использовать:

```
React Konva
```


Результат:

Есть рабочая сцена.


---

# Phase 3 — Object System


## Цель

Добавить базовые графические элементы.


## Text Object


Поддержка:

- создание;
- редактирование текста;
- перемещение;
- resize;
- rotate.


## Image Object


Поддержка:

- загрузка;
- отображение;
- масштабирование.


Результат:

Пользователь может создать простую графику.


---

# Phase 4 — Selection System


## Цель

Создать полноценное управление объектами.


Добавить:


- выделение объекта;
- групповое выделение;
- рамку выделения;
- resize handles;
- rotation handles;
- copy;
- paste;
- delete.


Результат:

Поведение похоже на графический редактор.


---

# Phase 5 — Layers System


## Цель

Управление объектами.


Добавить:


- список слоев;
- изменение порядка;
- переименование;
- скрытие;
- блокировка.


Результат:

Полноценная система слоев.


---

# Phase 6 — Inspector


## Цель

Редактирование свойств.


Добавить:


Position:

- X;
- Y;
- Width;
- Height.


Transform:

- rotation;
- scale.


Appearance:

- opacity;
- background;
- border;
- shadow.


Text:

- font;
- size;
- color;
- alignment.


Результат:

Все основные свойства доступны через UI.


---

# Phase 7 — History System


## Цель

Добавить Undo/Redo.


Поддержка:


- добавление объекта;
- удаление;
- перемещение;
- изменение свойств.


Результат:

Полноценная история действий.


---

# Phase 8 — Assets Browser


## Цель

Создать систему ресурсов.


Добавить:


- загрузку файлов;
- список ресурсов;
- thumbnails;
- категории.


Поддержка:


- изображения;
- GIF;
- видео;
- SVG.


Добавить:

drag & drop:

```
Asset Browser

        ↓

Canvas

        ↓

New Object
```


Результат:

Удобная работа с графикой.


---

# Phase 9 — Project Storage


## Цель

Сохранение проектов.


Создать:


```
project.json
```


Добавить:


- создание проекта;
- открытие проекта;
- сохранение;
- автосохранение.


Результат:

Проекты можно закрывать и открывать.


---

# Phase 10 — HTML/CSS Generator


## Цель

Генерация рабочего HTML.


Создать:


```
htmlGenerator.js

cssGenerator.js
```


Генерация:


```
project.json

        ↓

index.html

style.css
```


Поддержать:


- Text;
- Image;
- Video;
- SVG.


Результат:

Редактор создаёт настоящий HTML Overlay.


---

# Phase 11 — Live Preview


## Цель

Автоматическое обновление.


Добавить:


- WebSocket;
- file watcher;
- hot reload.


Поток:


```
Change Object

↓

Save Project

↓

Generate HTML/CSS

↓

Notify Browser

↓

Refresh Overlay
```


Результат:

Изменения видны сразу.


---

# Phase 12 — Advanced Graphics


Добавить:


Images:

- crop;
- filters;
- brightness;
- contrast;
- blur;
- object-fit.


Objects:

- GIF;
- Video;
- SVG.


---

# Phase 13 — Import System


## Цель

Работа с существующими файлами.


Поддержать:


HTML import:

- анализ DOM;
- создание объектов.


CSS import:

- чтение стилей.


Folder import:

- поиск ресурсов;
- восстановление проекта.


---

# Phase 14 — Unreal Integration


## Цель

Проверка в реальном использовании.


Тестировать:


- Unreal Browser Widget;
- Browser Source;
- прозрачный фон;
- обновление без перезапуска.


---

# Phase 15 — Optimization


Оптимизация:


- большие проекты;
- сотни объектов;
- быстрый рендер;
- уменьшение нагрузки.


Добавить:


- lazy loading;
- оптимизацию ресурсов;
- кэширование.


---

# Future Features


Возможные расширения:


## Animation System

- timeline;
- keyframes;
- transitions.


## Templates

- готовые сцены;
- шаблоны титров.


## Data Binding

Подключение:

- JSON;
- WebSocket;
- внешние данные.


## Broadcast Features

- vMix API;
- OBS control;
- real-time graphics control.


---

# Первый MVP


Минимальная рабочая версия:


```
React Canvas

+

Text Object

+

Image Object

+

Layers

+

Inspector

+

Save Project

+

Generate HTML/CSS
```


После этого проект уже способен создавать реальные Unreal Browser Overlay сцены.