<script>
    import { currentForm, currentName } from "./stores.js";
    let { update, initialData } = $props();

    // local state for each input
    let name = $state("");
    let url = $state("");
    let container = $state("");
    let title = $state("");
    let text = $state("");
    let img = $state("");
    let icon = $state("");
    let desc = $state("");

    currentName.subscribe((value) => {
        console.log("changed from subscription/!");
        console.log(value);
        name = value;
    });
    currentForm.subscribe((value) => {
        url = value.url;
        container = value.container;
        title = value.title;
        text = value.text;
        img = value.img;
        icon = value.icon;
        desc = value.desc;
    });

    async function handleSubmit(e) {
        e.preventDefault();

        const json = {
            [name]: { container, title, text, img, url, icon, desc },
        };

        const res = await fetch("http://localhost:3013/api/ch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(json),
        });

        const data = await res.json();
        console.log("Server response:", data);
        update();
    }
</script>

<main>
    <form on:submit={handleSubmit}>
        <label>
            Name:
            <input type="text" bind:value={name} />
        </label>
        <br />
        <label>
            Url:
            <input type="text" bind:value={url} />
        </label>
        <br />
        <label>
            Container element:
            <input type="text" bind:value={container} />
        </label>
        <br />
        <label>
            Title element:
            <input type="text" bind:value={title} />
        </label>
        <br />
        <label>
            Text element:
            <input type="text" bind:value={text} />
        </label>
        <br />
        <label>
            Img element:
            <input type="text" bind:value={img} />
        </label>
        <br />

        <label>
            Icon:
            <input type="text" bind:value={icon} />
        </label>
        <br />

        <label>
            Description:
            <input type="text" bind:value={desc} />
        </label>
        <br />
        <button type="submit">Send</button>
    </form>
</main>
