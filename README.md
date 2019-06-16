# react-hoox

A simple hook to observe any *Object*, including subtree, and update related *Component* when real change happens.

[Sandbox Demo](https://codesandbox.io/s/b55w2)


## Installation

```
npm install --save react-hoox
```

React **16.8.0** or later should be available as `react` package or provided as `React` variable.
**IE11** or better browser is required to run.


## Preparation

Add the following in "plugins" of your `.babelrc` or define as `babel` plugin any other way.

```js
{
  ...
  "plugins": [
     ...
     "module:react-hoox"
  ]
}
```


## Usage

Using `react-hoox` means calling only one identity `a => a` function. It returns provided *Object* (for destructuring purposes) without any changes.
> You can name it any way you want, for example, `use` or `use$` seem to be quite appropriate.

```js
import use from 'react-hoox';

function AnyComponent() {
    // it does not matter where anyObject comes from:
    // import, props, local variable, ...
    use(anyObject);
    ...
}
```

That's it. Now `AnyComponent` will be updated every time `anyObject` or its parts **really** changes (from human point of view, e.g. `[1,2,3] === [1,2,3]`)

A simple way to *connect* class-components or something else:

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

You can also introduce custom patterns based on `react-hoox` using higher-order functions/components or custom changes handler:

```js
import use$ from 'react-hoox';

// standalone usage - the function has different signature
// callback will be executed when 'anyObject' changes
const unsubscribe = use$(anyObject, obj => { ... });
```


## Why so serious?

Do you agree that you should think and a computer should calculate?

Do you agree that a computer can do a significant painful part of our work? And do it much better and without issues?

If so, then `react-hoox` is for you! It will help you write cleaner and more stable code, here are the main advantages of using:

+ **No boilerplate**. Just small *markers* in the code that mean "this code depends on this data" (*declarative* interpretation)

+ **No wrappers/dispatchers/managers** and so on. Everything you need is written locally in one place like "start observing this and update me on changes" (*imperative* interpretation)

+ **No immutability**, `react-hoox` will take care of that. You will receive a stream of *new* data states (*reactive* interpretation)

> Eventually, you will be able to replace `react-hoox` with another implementation of similar functionality (using `set`/`get`, or `Proxy`, or `Object.observe`, or whatever, with or without limitations) and *keep your code unchanged* - everything you need will be done by one function.


## Disclaimer

`react-hoox` may have a slight effect on application performance since it uses some CPU and RAM.
It depends on the amount of (simultaneously) observable data and on the browser/device, but never exceeds the fixed limit.
> See real-time notifications in the console for your situation.

The good news is that for typical applications and modern devices the calculations will most likely take *one-digit milliseconds* per second when another code works (1% or less) and several dozens Kb for caching.

Huge *Objects* (hundreds of Kb) can be used as well, but native `.toString` with necessary minimum to observe changes should be defined in such cases for performance.
>  If you exceed the limit, `react-hoox` will not be able to work in *microtask* mode, and updates may be delayed.

Detailed explanation of how this works and why resources are consumed will be provided in the future. For now the source code is your best friend.
Moreover, if you're thinking about using `react-hoox` in a serious production, you *should* definitely do it. 
