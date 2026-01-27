<script>
    let { feed } = $props();

    let showfeed = $state(false);

    $effect(() => {
        try {
            showfeed = Array.isArray(feed?.items) && feed.items.length > 0;
        } catch {
            showfeed = false;
        }
    });
</script>

<main>
    {#if showfeed}
        {#each feed.items as item}
            <div class="previewblock">
                <h1>{item.title}</h1>
                {#if item.description}
                    <div>{@html item.description}</div>
                {/if}
            </div>
        {/each}
    {/if}
</main>

<style>
    main {
        max-height: 300px;
        overflow: scroll;
    }

    .previewblock {
    background: #00000029;
padding: 13px 6px;
	    margin-bottom:10px;
    }

    h1 {
    margin-top: 0;
 font-family: "MS PGothic"
    }
</style>
