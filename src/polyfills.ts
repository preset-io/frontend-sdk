export function applyReplaceChildrenPolyfill() {
  (function (prototype) {
    // If the prototype already has a replaceChildren method, skip it
    if (prototype.hasOwnProperty('replaceChildren')) {
      return;
    }
    // Otherwise, define a new replaceChildren method on the prototype
    Object.defineProperty(prototype, 'replaceChildren', {
      configurable: true,
      enumerable: true,
      // The replaceChildren method takes any number of arguments
      value: function (...nodes: (Element | Text)[]) {
        // Remove all existing child nodes
        while (this.firstChild) {
          this.removeChild(this.firstChild);
        }
        // Add the new child nodes
        nodes.forEach((node) => {
          // If the node is a string, create a new text node
          // Otherwise, assume it's a DOM element and use it directly
          this.appendChild(
            typeof node === 'string' ? document.createTextNode(node) : node
          );
        });
      },
    });
  })(Element.prototype);
}
