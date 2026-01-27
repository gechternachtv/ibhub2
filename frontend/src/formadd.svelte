<script>
    import Rsspreview from "./rsspreview.svelte";
    import { currentForm, currentName } from "./stores.js";
    let { update } = $props();

    let feed = $state({});

    let name = $state("");
    let url = $state("");
    let container = $state("");
    let title = $state("");
    let text = $state("");
    let img = $state("");
    let icon = $state("");
    let desc = $state("");
    let showimg = $state(false);
    let lastUrl = "";
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

$effect(() => {
    if (lastUrl && url !== lastUrl) {
        feed = {};
    }
    lastUrl = url;
});


    $effect(() => {
        try {
            console.log(icon);
            if (icon != "") {
                const isimgvalidurl = new URL(icon);
                if (isimgvalidurl) {
                    showimg = true;
                }
            } else {
                showimg = false;
            }
        } catch (error) {
            showimg = false;
            console.warn(error);
        }
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

    const handleFetchMeta = async () => {
        const data = {
            page: url,
            container: container,
            imgselector: img,
            title: title,
        };
        console.log(JSON.stringify(data));

        const res = await fetch("http://localhost:3013/api/meta", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
        });

        const json = await res.json();

        console.log("Server responses:", json);

        currentForm.update((e) => {
            e.url = url;
            e.container = container;
            e.title = title;
            e.text = text;
            e.img = img;
            e.icon = icon;
            e.desc = desc;

            e.desc = json.title;
            e.icon = json.image;
            console.log(e);

            return e;
        });

        currentName.update((e) => {
            console.log(e);
            if (e == "") {
                return json.title;
            } else {
                return e;
            }
        });

        if (name == "") {
            name = json.title;
        }
    };
const handlePreview = async () => {
    if (!name) return;

    const res = await fetch(`http://localhost:3013/json/${encodeURIComponent(name)}`);

    if (!res.ok) {
        console.error("Preview failed");
        return;
    }

    const data = await res.json();
    feed = data;
};
</script>

<main>
    <div class="grid">
        <form onsubmit={handleSubmit}>
            <label>
                Name(id):
                <input type="text" bind:value={name} />
            </label>

            <label>
                Url:
                <input type="text" bind:value={url} />
            </label>

            <label>
                Container element:
                <input type="text" bind:value={container} />
            </label>

            <label>
                Title element:
                <input type="text" bind:value={title} />
            </label>

            <label>
                Text element:
                <input type="text" bind:value={text} />
            </label>

            <label>
                Img element:
                <input type="text" bind:value={img} />
            </label>

            <label>
                Icon:
                <input type="text" bind:value={icon} />
            </label>

            <label>
                Description:
                <input type="text" bind:value={desc} />
            </label>
        </form>
        <div class="controls">
            <button onclick={handleSubmit}>Send</button>
            <button onclick={handleFetchMeta}>fetch meta</button>
            <button onclick={handlePreview}>fetch posts</button>
        </div>
    </div>
    <div class="rsspreview">
        <Rsspreview {feed}></Rsspreview>
    </div>
    <div class="imgpreview">
        {#if showimg}
            <img src={icon} alt={name} />
        {/if}
    </div>
</main>

<style>
    * {
        font-size: 12px;
        font-family: bitbuntu;
    }
    main {
        background: #b70000;
        color: white;
        padding: 20px;
        display: grid;
        grid-template-columns: 1fr 2fr auto;
        gap: 20px;
    }

    input {
        border-radius: 3px;
        border: 0px;
    }
    .controls {
        display: flex;
        gap: 6px;
        padding-top: 10px;
    }
    button {
        color: #b70000;
        background: white;
        border: 0px;
        border-radius: 10px;
        padding: 0 8px;
    }
    form {
        display: grid;
        gap: 6px;
    }
    img {
        max-width: 400px;
    }
</style>
