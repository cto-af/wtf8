# @cto.af/wtf8

Encode and decode [WTF-8](https://simonsapin.github.io/wtf-8/) with a similar
API to
[TextEncoder](https://developer.mozilla.org/en-US/docs/Web/API/TextEncoder)
and
[TextDecoder](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder).

## Installation

```sh
npm install @cto.af/wtf8
```

## API

Full [API documentation](http://cto-af.github.io/wtf8/) is available.

Example:

```js
import {Wtf8Decoder, Wtf8Encoder} from '@cto.af/wtf8';

const bytes = new Wtf8Encoder().encode('\ud800');
const string = new Wtf8Decoder().decode(bytes);
```

---
[![Build Status](https://github.com/cto-af/wtf8/workflows/Tests/badge.svg)](https://github.com/cto-af/wtf8/actions?query=workflow%3ATests)
[![codecov](https://codecov.io/gh/cto-af/wtf8/branch/main/graph/badge.svg?token=N7B7YLIDM4)](https://codecov.io/gh/cto-af/wtf8)
