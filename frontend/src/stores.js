import { writable } from "svelte/store";
export const currentName = writable("name")
export const currentForm = writable({
    url: "url",
    container: "selector",
    title: "selector",
    text: "selector",
    img: "selector",
    icon: "url",
    desc: "text"

});