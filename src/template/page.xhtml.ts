const getText = (): string => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html
 xmlns="http://www.w3.org/1999/xhtml"
 xmlns:epub="http://www.idpf.org/2007/ops"
 xml:lang="{{lang}}"
>
<head>
<meta charset="UTF-8" />
<title>{{title}}</title>
<link rel="stylesheet" type="text/css" href="../style/fixed-layout-jp.css"/>
<meta name="viewport" content="width={{width}}, height={{height}}"/>
</head>
<body>
<div class="main">
{{body}}
</div>
</body>
</html>`

export default getText
