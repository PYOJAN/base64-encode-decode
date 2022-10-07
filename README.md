# **Dev Tool**

## **Description**

This is `Chrome` simple extention build with `Reactjs` to convert `[PDF, TXT, XML]` files in to `base64` and `urlencoded`.

![App Screenshot](https://raw.githubusercontent.com/PYOJAN/base64-encode-decode/master/public/Dev-tool.png)

---

#### Features

- Ease to use
- Convert file support _PDF, TXT, XML_ and _plain text_
- PDF file preview
- Single click copy paste
- Lightweight

### Browser Support

- Chrome `Tested`
- Microsoft edge `Tested`
- Brave Browser

## Setup

Clone this repo to your desktop:-

```bash
git clone https://github.com/PYOJAN/base64-encode-decode.git
```

Open the cloned folder

```bash
cd base64-encode-decode
```

and run bellow command to install all the dependencies.

```bash
yarn install
or
npm install
```

---

## Usage

Run tool on localhost

```bash
yarn dev or npm run dev
```

Build Extension Pack

```bash
yarn build or npm run build
```

_After building extension pack you need to make a small change manually in `html` file._

```ASII
. └── Project-folder/
		├── Dev-tool/
			├── dist/
			  ├── index.html
```

```html
<script type="module" crossorigin src="/file/path.js"></script>
<link rel="stylesheet" href="/file/path.css" />
```

Remove first `/` from `src=` and `href=` in both line and save.
Example:

```html
<script type="module" crossorigin src="file/path.js"></script>
<link rel="stylesheet" href="file/path.css" />
```

Now it ready to use with chrome unpacked extension.

---

[![forthebadge](https://forthebadge.com/images/badges/open-source.svg)](https://forthebadge.com)
This project is licensed under the terms of the **MIT** license.
