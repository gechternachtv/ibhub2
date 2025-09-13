<script>
    let { name, data, Delete, config } = $props();
</script>

<main>
    <img src={data.icon} alt="" />
    <h1>{name}</h1>
    <a class="mainlink" href={data.url}>{data.url}</a>
    <div>{data.container}</div>
    <div>{data.desc}</div>

    <div class="control">
        <a href="http://localhost:3013/xml/{name}">xml</a>
        <a href="http://localhost:3013/rss/{name}">rss</a>
        <button onclick={Delete}>del</button>
        <button onclick={config}> &lt;&lt; </button>
    </div>
</main>

<style>
    * {
        font-family: bitbuntu;
        font-size: 12px;
    }
    img {
        max-width: 100px;
    }
    .mainlink {
        color: #b70000;
        display: block;
        margin-bottom: 10px;
    }
    main {
        background: pink;
        padding: 10px;
    }
    .control {
        margin-top: 10px;
    }
    .control a,
    .control button {
        background: #b70000;
        border: 0px;
        border-radius: 10px;
        padding: 0 10px;
        color: white;
        text-decoration: none;
    }
</style>
