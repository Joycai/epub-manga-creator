const getText = (): string => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="{{lang}}">
<head>
<meta charset="UTF-8" />
<title>Navigation</title>
</head>
<body>
<nav epub:type="toc" id="toc">
<h1>Navigation</h1>
<ol>
<!-- navigation-list -->
</ol>
</nav>
<nav epub:type="landmarks" id="landmarks" hidden="hidden">
<h2>Landmarks</h2>
<ol>
<!-- landmarks-list -->
</ol>
</nav>
</body>
</html>
`

export default getText
