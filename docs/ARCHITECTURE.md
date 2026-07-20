# Overlay Editor - Architecture


# Общая архитектура


Главный принцип:

HTML/CSS являются конечным результатом, но не являются источником данных.


Архитектура:

```
                User

                 ↓

          React Editor UI

                 ↓

          Zustand Store

                 ↓

          Project Model

          /             \

         ↓               ↓

Canvas Renderer     HTML Generator

                         ↓

                  HTML + CSS Files

                         ↓

              Unreal Browser Source
```


---

# Структура проекта


```
overlay-editor/

├── frontend/

│   └── src/

│       ├── canvas/

│       ├── objects/

│       ├── panels/

│       ├── store/

│       └── types/


├── backend/

│   ├── generator/

│   ├── storage/

│   └── server.js


└── projects/

```


---

# Frontend Architecture


## Canvas Layer


Папка:

```
frontend/src/canvas/
```


Ответственность:

- отображение рабочего пространства;
- масштабирование;
- панорамирование;
- выделение объектов;
- управление трансформациями;
- обработка событий мыши.


Используемая технология:

```
React Konva
```


Canvas НЕ должен:

- сохранять проекты;
- генерировать HTML;
- работать с файлами.


---

# Objects System


Папка:

```
frontend/src/objects/
```


Каждый графический элемент является отдельным модулем.


Примеры:

```
TextObject.tsx

ImageObject.tsx

VideoObject.tsx

SvgObject.tsx
```


Каждый объект отвечает за:

- отображение;
- взаимодействие;
- собственные свойства.


---

# Project Model


Главная модель данных.


Пример:


```ts
interface Project {

    id: string;

    name: string;

    width: number;

    height: number;

    objects: CanvasObject[];

    assets: Asset[];

}
```


---

# Object Model


Все элементы наследуют базовую структуру:


```ts
interface CanvasObject {

    id: string;

    type: string;

    name: string;


    x: number;

    y: number;


    width: number;

    height: number;


    rotation: number;


    zIndex: number;


    style: object;

}
```


Пример объекта:


```json
{
    "id": "title",

    "type": "text",

    "name": "Main Title",

    "x": 200,

    "y": 100,

    "width": 500,

    "height": 80,

    "style": {

        "fontSize": 64,

        "color": "#ffffff"

    }
}
```


---

# State Management


Используется:

```
Zustand
```


Store хранит:


## Project State

- объекты;
- ресурсы;
- настройки.


## Editor State

- выбранный объект;
- выделение;
- zoom;
- состояние инструментов.


## History State

- undo;
- redo.


---

# Panels Architecture


Папка:

```
frontend/src/panels/
```


## Layers


Отвечает за:

- список объектов;
- порядок слоев;
- скрытие;
- блокировку.


## Inspector


Отвечает за:

- свойства выбранного объекта;
- изменение CSS;
- параметры элемента.


## Assets


Отвечает за:

- список ресурсов;
- загрузку;
- drag & drop.


---

# Backend Architecture


```
backend/

├── server.js

├── generator/

└── storage/

```


---

# Server


Файл:

```
server.js
```


Отвечает за:

- запуск Express;
- API;
- WebSocket соединения;
- обработку запросов редактора.


---

# Storage System


Папка:

```
backend/storage/
```


Отвечает за:

- создание проектов;
- загрузку;
- сохранение;
- работу с файлами.


Пример:


```
projects/

└── test/

    ├── project.json

    ├── index.html

    ├── style.css

    └── assets/

```


---

# HTML Generator


Папка:


```
backend/generator/
```


Отвечает за преобразование:


```
Project JSON

        ↓

HTML

CSS
```


Пример:


Project:

```json
{
"type":"text",
"text":"Hello"
}
```


Результат:


HTML:

```html
<div id="text1">
Hello
</div>
```


CSS:

```css
#text1 {

position:absolute;

left:100px;

top:100px;

}
```


---

# Live Preview Architecture


Изменение объекта:


```
User Action

↓

Canvas

↓

Zustand Store

↓

Save Project

↓

Generator

↓

HTML/CSS Update

↓

WebSocket Event

↓

Browser Reload
```


---

# Assets Architecture


Ресурсы хранятся отдельно:


```
assets/

├── images/

├── videos/

└── svg/

```


Объекты не содержат сами файлы.


Они содержат ссылку:


```json
{
"type":"image",

"assetId":"logo01"
}
```


Asset:


```json
{
"id":"logo01",

"type":"image",

"path":"assets/logo.png"
}
```


---

# Добавление новых объектов


Новый тип элемента должен:


1. Создать новый компонент:

```
objects/NewObject.tsx
```


2. Добавить тип:

```
types/project.ts
```


3. Добавить генерацию:

```
backend/generator/
```


4. Добавить UI создания объекта.


---

# Принципы разделения ответственности


## Canvas

Показывает.


## Store

Хранит.


## Generator

Создает HTML/CSS.


## Backend

Сохраняет.


## UI Panels

Изменяют свойства.


---

# Запрещенные подходы


Не использовать:


- хранение состояния только в HTML;
- прямое изменение DOM как основной способ работы;
- смешивание React компонентов и файловой системы;
- генерацию HTML внутри Canvas компонентов.


---

# Главная цель архитектуры


Получить систему:

```
Visual Editor

      ↓

Project Data

      ↓

HTML Runtime

      ↓

Unreal Engine Overlay
```


которая позволяет создавать профессиональную графику без ручного написания HTML/CSS.