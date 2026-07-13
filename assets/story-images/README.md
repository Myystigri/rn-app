# Story images

Place narrative message images in this folder. Ink image tags use paths relative to this directory:

```ink
# image:maya/apartment-door.jpg
```

An image tag may be paired with message text. For an image-only message, add an empty Ink string after its tags so Ink creates a separate output event:

```ink
# id:intro.maya.image.001
# speaker:maya
# conversation:maya
# image:maya/apartment-door.jpg
{""}
```

Run `npm run compile:ink` after adding, removing, or renaming a story image so the static Expo asset catalog is regenerated.
