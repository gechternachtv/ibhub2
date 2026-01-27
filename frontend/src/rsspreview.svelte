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
		<div class="gridcontainer">		
		{#if item.img}
		<img src={item.img}/>
		{/if}
                {#if item.description}
                    <div>{@html item.description}</div>
                {/if}
		</div>
            </div>
        {/each}
    {/if}
</main>

<style>
img{
	max-width:200px
}
    main {
        max-height: 300px;
        overflow: scroll;
    }

    .previewblock {
    background: #00000029;
padding: 13px 10px;
	    margin-bottom:10px;
    }

    h1 {
    margin-top: 0;
 font-family: "MS PGothic"
    }

.gridcontainer {
  display: grid;
  grid-template-columns: auto 1fr;
  gap:10px;
}

img{
  max-height: 200px;
}

</style>
