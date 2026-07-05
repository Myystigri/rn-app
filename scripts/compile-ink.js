const fs = require('fs');
const path = require('path');

const { Compiler, CompilerOptions } = require('inkjs/full');

const projectRoot = path.resolve(__dirname, '..');
const storiesRoot = path.join(projectRoot, 'src', 'story');
const generatedRoot = path.join(storiesRoot, 'generated');

const INK_WARNING = 1;
const INK_ERROR = 2;

main();

function main() {
  const storyFiles = findInkFiles(storiesRoot);

  if (storyFiles.length === 0) {
    console.error(`No .ink files found under ${path.relative(projectRoot, storiesRoot)}`);
    process.exit(1);
  }

  for (const storyFile of storyFiles) {
    compileStoryFile(storyFile);
  }
}

function findInkFiles(directoryPath) {
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
  const storyFiles = [];

  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      if (entryPath === generatedRoot) {
        continue;
      }

      storyFiles.push(...findInkFiles(entryPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.ink')) {
      storyFiles.push(entryPath);
    }
  }

  return storyFiles.sort();
}

function compileStoryFile(inputPath) {
  const inputSource = fs.readFileSync(inputPath, 'utf8');
  const warnings = [];
  const errors = [];

  const compiler = new Compiler(
    inputSource,
    new CompilerOptions(inputPath, [], false, (message, type) => {
      if (type === INK_WARNING) {
        warnings.push(message);
        return;
      }

      if (type === INK_ERROR) {
        errors.push(message);
      }
    }, createFileHandler())
  );

  let runtimeStory;
  try {
    runtimeStory = compiler.Compile();
  } catch (error) {
    if (error instanceof Error && error.message === 'Compilation failed.') {
      reportFailure(inputPath, errors);
      return;
    }

    throw error;
  }

  if (errors.length > 0) {
    reportFailure(inputPath, errors);
    return;
  }

  const compiledJson = runtimeStory.ToJson();
  if (typeof compiledJson !== 'string') {
    throw new Error(`Ink compiler did not return JSON for ${inputPath}`);
  }

  const outputPath = toOutputPath(inputPath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${compiledJson}\n`);

  const inputLabel = path.relative(projectRoot, inputPath);
  const outputLabel = path.relative(projectRoot, outputPath);
  console.log(`Compiled ${inputLabel} -> ${outputLabel}`);

  for (const warning of warnings) {
    console.warn(`[warn] ${warning}`);
  }
}

function toOutputPath(inputPath) {
  const relativeInputPath = path.relative(storiesRoot, inputPath);
  const outputRelativePath = relativeInputPath.replace(/\.ink$/, '.story.json');
  return path.join(generatedRoot, outputRelativePath);
}

function createFileHandler() {
  const resolveInkFilename = (filename, sourceFilename = null) => {
    const baseDirectory = sourceFilename ? path.dirname(sourceFilename) : storiesRoot;
    return path.resolve(baseDirectory, filename);
  };

  return {
    ResolveInkFilename: resolveInkFilename,
    LoadInkFileContents(filename, sourceFilename = null) {
      const resolvedPath = resolveInkFilename(filename, sourceFilename);
      return fs.readFileSync(resolvedPath, 'utf8');
    },
  };
}

function reportFailure(inputPath, errors) {
  const label = path.relative(projectRoot, inputPath);
  const details = errors.length > 0 ? errors.join('\n') : 'Unknown Ink compilation error.';
  console.error(`Failed to compile ${label}\n${details}`);
  process.exitCode = 1;
}
