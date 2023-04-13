import { applyReplaceChildrenPolyfill } from './polyfills';

describe('replaceChildren polyfill', () => {
  it('should add replaceChildren method to the prototype', () => {
    const originalReplaceChildren = Element.prototype.replaceChildren;
    // Remove the replaceChildren implementation from the Element prototype
    delete (Element.prototype as any).replaceChildren;
  
    // Check that the replaceChildren method does not exist
    expect(HTMLElement.prototype.replaceChildren).toBeUndefined();
  
    // Apply the polyfill
    applyReplaceChildrenPolyfill();
  
    // Check that the replaceChildren method has been added to the HTMLElement prototype
    expect(HTMLElement.prototype.replaceChildren).toBeDefined();
    expect(HTMLElement.prototype.replaceChildren).not.toEqual(originalReplaceChildren);
  
    // Restore the original replaceChildren implementation
    Object.defineProperty(Element.prototype, 'replaceChildren', {
      configurable: true,
      enumerable: true,
      value: originalReplaceChildren,
      writable: true,
    });
  });

  it('should replace children correctly', () => {
    // Create a parent element with two child elements
    const parent = document.createElement('div');
    const child1 = document.createElement('p');
    const child2 = document.createElement('span');
    parent.appendChild(child1);
    parent.appendChild(child2);

    // Replace the children with a new child element
    parent.replaceChildren(document.createElement('a'));

    // Check that the parent element only has one child
    expect(parent.children.length).toBe(1);
    // Check that the child element has been replaced with a new one
    expect(parent.children[0].tagName).toBe('A');
  });
});
