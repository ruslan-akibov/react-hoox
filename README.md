# React Hoox

[Hook](https://reactjs.org/docs/hooks-intro.html) to observe any *Object* and update related *Component* on real changes.

## Install

```
npm install --save react-hoox
```

React **16.8.0** or later should be available as `react` package or provided as `React` variable.

## Prepare

Put in "plugins" of your `.babelrc` or define as `babel` plugin another way.

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

Just one function. Will return provided *Object* (for destructuring purposes). Any naming could be chosen, `use` or `use$` seems very nice ones.

```js
import use from 'react-hoox';

function AnyComponent() {
    // not matter where anyObject was taken from:
    // import, props, local variable, ...
    use(anyObject);
    ...
}
```

That's it. Now you can asynchronously mutate your 'anyObject' as long as you prefer. 
'AnyComponent' will be updated each time 'anyObject' **really** changes (from human or `JSON.stringify` point of view)

You could even *connect* class-components (if you like such things):

```js
function MyConnectedComponent(props) {
    // you could make destructuring 'in-place'
    const { prop1, method1 } = use(anyObject);

    // and render Component using recent data
    return (
        <MyClassComponent {...props}
            // 'key' allows to control updates
            key={}
            // props passed non-magical way
            prop1={prop1}
        />
    );
}
```


## Disclaimer

`react-hoox` *will* affect overall application performance since it use some CPU and RAM.

The bad news is that it depends on the amount of observable (simultaneously) data, and on the browser/device.

The good news is that for typical applications and modern devices, usage will be *one-digit milliseconds* per second (1% or less).

Sure, detailed explanation how it works and why resources are used will be provided. But later. For now, please use sources, just 255 lines.
Moreover, if you going to use `react-hoox` in serious production, you *should* do it. 
