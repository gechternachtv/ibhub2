import { writable } from "svelte/store";
export const currentName = writable("")
export const currentForm = writable({
    url: "",
    container: "",
    title: "",
    text: "",
    img: "",
    icon: "",
    desc: ""

});