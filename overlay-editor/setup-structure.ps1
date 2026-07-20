# Frontend folders
$folders = @(
    "frontend/src/canvas",
    "frontend/src/objects",
    "frontend/src/panels",
    "frontend/src/store",
    "frontend/src/types",
    "backend/generator",
    "backend/storage",
    "projects/test"
)

foreach ($folder in $folders) {
    New-Item -ItemType Directory -Force -Path $folder | Out-Null
}

# Frontend files
$files = @(
    "frontend/src/canvas/Canvas.tsx",
    "frontend/src/canvas/Selection.tsx",
    "frontend/src/canvas/Guides.tsx",

    "frontend/src/objects/TextObject.tsx",
    "frontend/src/objects/ImageObject.tsx",
    "frontend/src/objects/VideoObject.tsx",

    "frontend/src/panels/Layers.tsx",
    "frontend/src/panels/Inspector.tsx",
    "frontend/src/panels/Assets.tsx",

    "frontend/src/store/projectStore.ts",
    "frontend/src/types/project.ts",

    "backend/server.js",
    "backend/generator/htmlGenerator.js",
    "backend/generator/cssGenerator.js",
    "backend/storage/projectManager.js",

    "projects/test/.gitkeep"
)

foreach ($file in $files) {
    if (!(Test-Path $file)) {
        New-Item -ItemType File -Force -Path $file | Out-Null
    }
}

Write-Host "Overlay Editor structure created!"