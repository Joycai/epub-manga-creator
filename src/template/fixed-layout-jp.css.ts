const getText = (): string => `@charset "UTF-8";

html,
body {
    margin:    0;
    padding:   0;
    width:     100%;
    height:    100%;
    font-size: 0;
    background-color: {{bgColor}};
}
.main {
    margin:  0;
    padding: 0;
    width:   100%;
    height:  100%;
}
svg, img {
    margin:  0;
    padding: 0;
    display: block;
}
`

export default getText
