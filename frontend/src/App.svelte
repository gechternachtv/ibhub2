<script>
  async function handleSubmit(e) {
    e.preventDefault();
    const form = new FormData(e.target);
    const name = form.get("link");

    const json = {
      [name]: {
        container: form.get("container"),
        title: form.get("title"),
        text: form.get("text"),
        img: form.get("img"),
      },
    };

    const res = await fetch("http://localhost:3013/api/ch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(json),
    });

    const data = await res.json();
    console.log("Server response:", data);
  }
</script>

<main>
  <form on:submit={handleSubmit}>
    <label>
      Link:
      <input type="text" name="link" />
    </label>
    <br />
    <label>
      Container:
      <input type="text" name="container" value=".post, .thread" />
    </label>
    <br />
    <label>
      Title:
      <input type="text" name="title" value=".post_no" />
    </label>
    <br />
    <label>
      Text:
      <input type="text" name="text" value=".body" />
    </label>
    <br />
    <label>
      Img:
      <input type="text" name="img" value="img" />
    </label>
    <br />
    <button type="submit">Send</button>
  </form>
</main>
