const getText = (): string => `<?xml version="1.0" encoding="UTF-8"?>
<package
  xmlns="http://www.idpf.org/2007/opf"
  version="3.0"
  xml:lang="{{lang}}"
  unique-identifier="unique-id"
  prefix="ibooks: http://vocabulary.itunes.apple.com/rdf/ibooks/vocabulary-extensions-1.0/"
>

<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">

<dc:title id="title">{{title}}</dc:title>
<dc:language>{{lang}}</dc:language>
<dc:identifier id="unique-id">{{identifier}}</dc:identifier>
<meta property="dcterms:modified">{{createTime}}</meta>

<!-- optional-metadata -->

<meta property="rendition:layout">pre-paginated</meta>
<meta property="rendition:orientation">auto</meta>
<meta property="rendition:spread">{{spread}}</meta>
<meta property="ibooks:binding">false</meta>
<!-- legacy-cover -->

<meta property="schema:accessMode">visual</meta>
<meta property="schema:accessibilityFeature">tableOfContents</meta>
<meta property="schema:accessibilityHazard">unknown</meta>

</metadata>

<manifest>

<item media-type="application/xhtml+xml" id="toc" href="navigation-documents.xhtml" properties="nav" />
<item media-type="text/css" id="fixed-layout-jp" href="style/fixed-layout-jp.css" />

<!-- item-image -->

<!-- item-xhtml -->

</manifest>

<spine page-progression-direction="{{direction}}">

<!-- itemref-xhtml -->

</spine>

</package>`

export default getText
