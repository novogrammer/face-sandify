export function domReady(onReady: () => void) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onReady);
  } else {
    onReady();
  }
}

interface Size {
  width: number;
  height: number;
}

export function getElementSize(element: HTMLElement): Size {
  return {
    width: element.clientWidth,
    height: element.clientHeight,
  }
}

export function querySelectorOrThrow<Type extends HTMLElement>(query:string):Type{
  const element = document.querySelector<Type>(query);
  if(!element){
    throw new Error(`element is null : ${query}`);
  }
  return element;
}