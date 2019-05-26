# react-hoox

Hook to observe any *Object* and update related *Component* on real changes.

Try it in the [sandbox](https://codesandbox.io/s/b55w2)


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

That's it. Now you can asynchronously mutate 'anyObject' or its parts as long as you prefer. 
'AnyComponent' will be updated each time 'anyObject' **really** changes (from human or `JSON.stringify` point of view)

Transparent way to *connect* class-components (if you like such things):

```js
function MyConnectedComponent(props) {
    // destructuring 'in-place'
    const { prop1, method1 } = use(anyObject);

    // render Component using recent data
    return (
        <MyClassComponent {...props}
            // 'key' allows to control updates
            key={}
            // no implicit props
            prop1={prop1}
        />
    );
}
```

You can introduce custom patterns based on `react-hoox` as well, using higher-order functions/components or custom changes handler:

```js
import use$ from 'react-hoox';

// standalone usage - the function has a different signature
// callback will be executed on 'anyObject' changes
const unsubscribe = use$(anyObject, obj => { ... });
```


## Why so serious?

Do you agree that you should think, and a computer should count?

Do you agree that a computer can take on a significant painful part of our work? And do it much better and without issues?

If so, then `react-hoox` will try to help you produce much cleaner and more stable code, and with it you will get:

* No any kind of boilerplate. Just small *markers* in the code, which means "this code depends on this data" (*declarative* interpretation)

* No any kind of wrappers/dispatchers/managers and so on. Everything required is written locally in one place of your code, like "start observing this and update me on changes" (*imperative* interpretation)

* No any kind of immutability, `react-hoox` will take care of this. You will receive a stream of *new* data states (*reactive* interpretation)

Eventually, you could replace `react-hoox` with another implementation of the similar functionality (using `set`/`get`, or `Proxy`, or `Object.observe`, or whatever, with or without limitations), but keep your code unchanged.
All required will be implemented in one function, if you will follow this way.


## Disclaimer

`react-hoox` will affect overall application performance since it uses some CPU and RAM, you will see real-time usage notifications in the console.

The bad news is that it depends on the amount of observable (simultaneously) data, and on the browser/device.

The good news is that for typical applications and modern devices, the calculations most likely will takes *one-digit milliseconds* per second, when another code works (1% or less), and several dozens Kb for caching. See detailed notifications about your case.

Sure, detailed explanation of how this works and why resources are used will be provided. But later. For now, please use sources.
Moreover, if you are going to use `react-hoox` in serious production, you *should* do it. 
