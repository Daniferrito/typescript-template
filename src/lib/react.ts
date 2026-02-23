import ReactNamespace from 'react/index';
import ReactDomNamespace from 'react-dom';

const w = eval("window")

const React = w.React as typeof ReactNamespace;
const ReactDOM = w.ReactDOM as typeof ReactDomNamespace;

export default React;
export {
  ReactDOM
}