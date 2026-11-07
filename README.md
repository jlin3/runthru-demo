# Shelf

Shelf is a small personal reading list: add books, see them as generated covers, and move each one between *Want to read*, *Reading* and *Finished*. It is plain HTML, CSS and JavaScript in [`app/`](app/), with no build step and no dependencies. Your books are saved in your browser's localStorage.

## Why this repo exists

Shelf is the demo project for [RunThru](https://runthru.co), a tool that films a narrated video walkthrough of every pull request.

Each open pull request in this repo adds one feature to Shelf, and each one has a RunThru video in its comments. Open any PR, scroll to the RunThru comment and watch the change being used, without checking out the branch.

## Try RunThru on your own repo

1. Install the [RunThru GitHub App](https://github.com/apps/runthru) on the repository.
2. Open a pull request (or pick an existing one).
3. Comment `/runthru` on the PR. RunThru opens the PR's preview, clicks through the change, and turns its comment into a narrated video with a verdict on whether the feature works.

For a static site like this one, a two-line [`.runthru.yml`](.runthru.yml) tells RunThru which folder of the PR's commit to serve. Nothing is built or run. Apps with deploy previews (Vercel, Netlify, Render and others) need no config at all.

## Run Shelf locally

```sh
cd app
python3 -m http.server 8000
```

Then open http://localhost:8000.

## License

[MIT](LICENSE)
