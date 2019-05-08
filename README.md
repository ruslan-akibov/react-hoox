# React-Hoox

React [Hook](https://reactjs.org/docs/hooks-intro.html) to observe any plain object changes and re-render related component.

## Install

```
npm install --save react-hoox
```

React 16.8.0 or later is **should be installed**.

## Prepare

Install as a plugin in your `.babelrc`
```js
{
  ...
  "plugins": [
     ...
     "module:react-hoox"
  ]
}
```

## Use

```js
import use from 'react-hoox';

function AnyComponent() {
    use([any-plain-object]);
    ...
}
```

## Disclaimer

Not so fast, guys.
