# NestedText

Please see https://nestedtext.org/ for more information about this format.

In brief, it allows software to have data stored as text, similar to YAML and JSON, but without the abiguity and quoting that's necessary with either one of those.

Here's a short example.

```
Katheryn McDaniel:
    position: president
    address:
        > 138 Almond Street
        > Topeka, Kansas 20697
    phone:
        cell: 1-210-555-5297
        home: 1-210-555-8470
            # Katheryn prefers that we always call her on her cell phone.
    email: KateMcD@aol.com
    additional roles:
        - board member
```

This is the JavaScript implementation of NestedText.


## API

Start by loading the library. Choose your favorite method.

```js
// CommonJS
const NestedText = require('nestedtext').NestedText;
```

```js
// Modules
import NestedText from 'nestedtext';

// Alternately, load just the parts you need. This is the best for tree-shaking.
import { dump, load } from 'nestedtext';
```

```html
<!-- Browser, HTML, loaded as window.NestedText -->
<script src="https://unpkg.com/nestedtext"></script>
```

```html
<!-- Browser, loaded as a module -->
<script>
import NestedText from 'https://unpkg.com/inject-hooks?module';

// Or just load the parts you need
import { dump, load } from 'https://unpkg.com/inject-hooks?module';
</script>
```


### `NestedText.load(input: string)`

Convert NestedText to native data structures.

### `NestedText.dump(input: string, options: DumpOptions)`

Convert native data to NestedText.

The options can have the following properties:

* `indent`: What to use for indent. This must contain only spaces and must contain at least one space, otherwise it generates invalid NestedText. Defaults to four spaces to match the official tests.
* `newline`: The newline character to use. Defaults to `\n`.
