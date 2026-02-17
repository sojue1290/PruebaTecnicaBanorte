# Prueba tecnica Banorte Josué Federico Saucedo Soto
# Comparador de PDFs (JavaScript)

Comparador de documentos PDF nativos implementado en JavaScript puro que
detecta diferencias entre dos versiones de un documento (original vs
evaluado).

El sistema analiza el contenido textual del PDF, identifica cambios y
los muestra con su ubicación exacta (página y coordenadas), permitiendo
además exportar un reporte.

## Objetivo

Desarrollar una herramienta client-side capaz de: - Comparar dos PDFs -
Detectar texto modificado, agregado o eliminado - Mostrar ubicación
precisa dentro del documento - Exportar resultados

## Requerimientos

-   Input para documento original
-   Input para documento evaluado
-   Evaluación y normalización de texto
-   Visualización con página y coordenadas (x, y)
-   Exportación de resultados
-   Sin librerías de terceros
-   Mínimo 3 páginas por documento

## Alcance

### Incluido

-   Comparación de texto entre dos PDFs (3+ páginas)
-   Detección de modificados, agregados y removidos
-   Ubicación exacta: página y coordenadas
-   Filtros por tipo de cambio
-   Exportación de resultados (HTML / JSON)
-   Soporte para Form XObjects
-   Soporte para múltiples encodings comunes

### Excluido

-   PDFs escaneados (sin capa de texto)
-   Comparación visual o de imágenes
-   PDFs con contraseña o encriptados
-   Edición de documentos

## Restricciones Técnicas

-   Sin librerías de terceros (parser PDF propio)
-   100% client-side
-   JavaScript Vanilla (ES6+)
-   Requiere navegador moderno

## Arquitectura

Patrón: Arquitectura en capas (Layered Architecture)

UI Layer → Interfaz y eventos Domain Layer → Lógica de comparación
Reader Layer → Parsing del PDF

## Componentes Principales

### Reader Layer (reader/pdf/)

Responsable de parsear PDFs y extraer texto.

Componentes: - PdfObjectIndexBuilder: Parsea estructura PDF (xref y
objetos) - PdfStreamDecoder: Decodifica streams comprimidos -
PdfTextExtractor: Procesa operadores PDF (Tj, TJ, Tm, Td) -
PdfPageTreeResolver: Navega árbol de páginas - LineGrouper: Agrupa texto
por coordenadas

Flujo: PDF bytes → Indexa objetos → Encuentra páginas → Decodifica
streams → Tokeniza operadores → Extrae texto → Agrupa en líneas →
DocumentModel

### Domain Layer (domain/)

Responsable de comparación y modelado.

Componentes: - DocumentComparer: Orquesta comparación página por
página - LcsDiffer: Algoritmo Longest Common Subsequence -
TextNormalizer: Normalización de texto - DocumentModel / PageModel /
TextItem: Modelos inmutables

Algoritmo LCS: dp\[i\]\[j\] = subsecuencia común más larga entre a\[i:\]
y b\[j:\]

Operaciones generadas: - equal: textos coinciden - replace: delete +
insert - insert: texto agregado - delete: texto removido

Complejidad: Tiempo: O(n × m) Espacio: O(n × m)

### UI Layer (ui/)

Responsable de la interacción. - app.js: Controlador principal (MVC
style) - Drag & Drop - Filtros - Renderizado dinámico

## Ejecución

Abrir aplicación:

open src/ui/views/index.html

O doble click en el archivo.

## Uso

### 1. Cargar documentos

Opción Drag & Drop: - Arrastra el PDF original al panel izquierdo -
Arrastra el PDF evaluado al panel derecho

Opción Click: - Haz click en la zona de carga - Selecciona el archivo

### 2. Comparar

-   Cargar ambos PDFs
-   Presionar Comparar
-   Esperar procesamiento

### 3. Revisar resultados

El sistema muestra: - Página - Tipo de cambio - Texto original - Texto
nuevo

Filtros: - Todas - Modificadas - Agregadas - Removidas

### 4. Exportar

HTML: reporte.html

JSON: reporte.json

Incluye: - timestamp - página - coordenadas - textos

## Ejemplo

Entrada: contrato_v1.pdf contrato_v2.pdf

Salida: 3 diferencias encontradas en 3 páginas

Página 1 - Texto modificado "Monto: \$200,000" "Monto: \$225,000"

Página 2 - Texto agregado "CURP: ABC123XYZ"

## Decisiones Técnicas

### Parser PDF Custom

Motivo: requisito sin librerías externas.

Ventajas: - Control total - Peso ligero - Manejo de edge cases

Trade-off: - Solo soporta subset de PDF

### Algoritmo LCS

Elegido por ser estándar (similar a git diff) y minimizar cambios.

Alternativas descartadas: - Diff línea por línea - Levenshtein

### Normalización de Texto

Comparación: "HOLA Mundo" → "hola mundo"

Visualización: "HOLA Mundo" → "HOLA Mundo"

Evita cambios cosméticos.

### Agrupación en Líneas

Problema: PDFs almacenan palabras separadas. Solución: Agrupar por
coordenada Y.

Threshold dinámico: fontSize × 0.25

### Form XObjects

Soporte con recursión limitada: - Detecta operador Do - Resuelve hasta 5
niveles

## Limitaciones

### Técnicas

-   No OCR
-   No PDFs escaneados
-   No encriptados
-   Solo texto nativo

### Encodings

Soportados: - FlateDecode - ASCII85 - Sin compresión

No soportados: - LZW - JBIG2

### Comparación

-   Página N vs página N
-   No detecta páginas agregadas/removidas

### Memoria

-   Carga completo en RAM
-   PDFs grandes pueden ser lentos

### Seguridad

-   No contraseña
-   No firma digital
-   No cifrado

## Compatibilidad

Requiere: - ES6+ - File API - Blob API - DecompressionStream

Navegadores mínimos: - Chrome 90+ - Firefox 88+ - Safari 14+ - Edge 90+
