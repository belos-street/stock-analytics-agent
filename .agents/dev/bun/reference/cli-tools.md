# Bun CLI Tools

Learn how to build CLI tools with Bun.

## Why Bun for CLI?

- **Fast**: 3x faster startup than Node.js
- **Native TypeScript**: Direct TS execution without compilation
- **Single Binary**: Build standalone executables with `bun build --compile`
- **Small Bundle**: Smaller binary size than Go/Rust alternatives

## Bun Build Executable

### Compile to Binary

```bash
# Build standalone executable
bun build ./src/index.ts --compile --outfile my-cli

# Make it executable
chmod +x my-cli

# Run
./my-cli
```

### Build Options

```bash
# Target different platforms
bun build ./src/index.ts --compile --outfile my-cli --target linux-x64
bun build ./src/index.ts --compile --outfile my-cli --target darwin-arm64
bun build ./src/index.ts --compile --outfile my-cli.exe --target windows-x64

# Minify
bun build ./src/index.ts --compile --outfile my-cli --minify
```

### package.json Configuration

```json
{
  "name": "my-cli",
  "version": "1.0.0",
  "bin": {
    "my-cli": "./dist/index.js"
  },
  "scripts": {
    "build": "bun build ./src/index.ts --compile --outfile ./dist/my-cli",
    "dev": "bun run ./src/index.ts"
  }
}
```

## Command Line Arguments with Commander

### Basic Usage

```ts
import { Command } from 'commander'

const program = new Command()

program
  .name('my-cli')
  .description('A sample CLI tool')
  .version('1.0.0')

program
  .command('greet')
  .description('Greet someone')
  .argument('<name>', 'Name to greet')
  .option('-l, --loud', 'Greet loudly')
  .action((name, options) => {
    const greeting = `Hello, ${name}!`
    console.log(options.loud ? greeting.toUpperCase() : greeting)
  })

program.parse()
```

```bash
my-cli greet John              # Hello, John!
my-cli greet John --loud       # HELLO, JOHN!
```

### Options with Values

```ts
program
  .command('download')
  .description('Download a file')
  .option('-o, --output <path>', 'Output file path', 'output.txt')
  .option('-t, --timeout <seconds>', 'Timeout in seconds', '60')
  .action((options) => {
    console.log(`Downloading to: ${options.output}`)
    console.log(`Timeout: ${options.timeout}s`)
  })
```

### Subcommands

```ts
// Main program
const program = new Command()

// Subcommand: user
program
  .command('user')
  .description('User management')
  .action(() => {
    console.log('User management')
  })

// Subcommand: user add
program
  .command('user add')
  .description('Add a user')
  .argument('<name>', 'User name')
  .action((name) => {
    console.log(`Adding user: ${name}`)
  })

program.parse()
```

## Color Output with Chalk

### Basic Usage

```ts
import chalk from 'chalk'

console.log(chalk.blue('Hello World!'))
console.log(chalk.red.bold('Error!'))
console.log(chalk.green.bgBlack('Success!'))
```

### Color Chain

```ts
import chalk from 'chalk'

console.log(chalk.blue.underline.bold('Important Link'))
console.log(chalk.red.bgWhite('Warning'))
console.log(chalk.green('✓ ') + 'Success')
console.log(chalk.red('✗ ') + 'Failed')
```

### Template String

```ts
import chalk from 'chalk'

const name = 'John'
const status = 'online'

console.log(chalk`{green.bold Hello} {blue ${name}}!`)
console.log(chalk`Status: {${status === 'online' ? 'green' : 'red'} ${status}}`)
```

### Available Colors

```
# Foreground colors
black, red, green, yellow, blue, magenta, cyan, white

# Bright colors  
brightBlack, brightRed, brightGreen, brightYellow, brightBlue, brightMagenta, brightCyan, brightWhite

# Background colors
bgBlack, bgRed, bgGreen, bgYellow, bgBlue, bgMagenta, bgCyan, bgWhite
```

### Available Modifiers

```
bold, dim, italic, underline, overline, inverse, hidden, strikethrough
```

## ASCII Art with Figlet

### Basic Usage

```ts
import figlet from 'figlet'

figlet('Hello', (err, data) => {
  if (err) {
    console.log('Something went wrong...')
    return
  }
  console.log(data)
})
```

Output:
```
 _   _ _      _ _ _      
| | | | |    | | | |     
| |_| | |    | | | |     
|  _  | |    | | | |     
| | | | |____| | | |____ 
|_| |_|______| |_|_______|
```

### With Options

```ts
import figlet from 'figlet'

figlet('Bun', {
  font: 'Standard',
  horizontalLayout: 'default',
  verticalLayout: 'default',
  width: 80,
  whitespaceBreak: true
}, (err, data) => {
  console.log(data)
})
```

### Available Fonts

```
Standard, Ghost,doom, Big, Block, Bubble, Digital, Ivrit, Lean, Letters, 
Math, Mitchy, Nancyj, Ogre, Rectangles, Relief, Relief2, Roman, 
Rounded, Rowanda, Shadow, Slant, Speed, Standard, Starwars, Stop, 
Thin, Thick, Tiny,ANSI Shadow, ANSI Regular, Basic, Calvin, Cosmic, 
Crawford, Crawford2, Decimal, Diet Cola, Dancing, Efti, Epic, 
Fourtop, Fraktur, Fun Faces, Fun Faces2, Fuzzy, Georgia, Ghost, 
Ghoulish, Glitch, Granny, Green_Back, Halloween, Hammerhead, 
Henry, Hex, Hollywood, Home, ICU, Impossible, ICL, Larry, LCD, 
Lean, Letters, Lil_Devil, Linux, Lockergnome, Madrid, Marquee, 
Maxfour, Mike, Mini, Mirror, MNight, Mossy, Nancyj, Nipples, 
O8, Octal, Ogre, Opr, Oswald, Pagga, Patorjk-He, Patorjk-Tech, 
Pawp, Pepper, Poison, Puffy, Puzzle, Pystac, Pystacio, Quantum, 
Raven, Rectangles, Red Phoenix, Relief, Relief2, Riv, Road_Raid, 
Robo, Rot13, Rowanda, Santa Clara, SBlood, Script, Shadow, 
Shimrod, Short, Slant, Slant_R, Smile, SOUNDTRAX, Spider, 
Spike, Spliff, Stamp, Stampede, Standard, Star_Left, Star_Right, 
Stop, Straight, Strong, Sub-Zero, Sweet, Template, Term, Test1, 
Test2, Thick, Thin, THIS, Thorns, Ticks, Tiles, Tinky, Tiny, 
Tomb, Tomb_Ep, TOS, Trajan, Trek, TRS80, Twisted, UPSIDOWN, 
USA Flag, Vortron, Weak, Weird, Whimpy, WOW, Xbrackets, Xcopy, 
Xenon, X
```

## Interactive Prompts with Prompts

### Text Input

```ts
import prompts from 'prompts'

const response = await prompts({
  type: 'text',
  name: 'name',
  message: 'What is your name?'
})

console.log(`Hello, ${response.name}!`)
```

### Confirm

```ts
const response = await prompts({
  type: 'confirm',
  name: 'confirm',
  message: 'Do you want to continue?',
  initial: true
})

if (response.confirm) {
  console.log('Continuing...')
}
```

### Select

```ts
const response = await prompts({
  type: 'select',
  name: 'framework',
  message: 'Pick a framework',
  choices: [
    { title: 'Vue', value: 'vue' },
    { title: 'React', value: 'react' },
    { title: 'Svelte', value: 'svelte' }
  ]
})

console.log(`You chose: ${response.framework}`)
```

### Multi-Select

```ts
const response = await prompts({
  type: 'multiselect',
  name: 'colors',
  message: 'Pick colors',
  choices: [
    { title: 'Red', value: 'red', selected: true },
    { title: 'Green', value: 'green' },
    { title: 'Blue', value: 'blue' }
  ]
})

console.log(response.colors) // ['red', 'blue']
```

### Number

```ts
const response = await prompts({
  type: 'number',
  name: 'age',
  message: 'How old are you?',
  validate: (value) => value < 18 ? 'You must be 18+' : true
})
```

## Progress Bar with cli-progress

### Basic Usage

```ts
import cliProgress from 'cli-progress'

const bar = new cliProgress.SingleBar({}, cliProgress.presenter.pretty)

bar.start(100, 0)

for (let i = 0; i <= 100; i += 10) {
  bar.update(i)
  await sleep(100) // simulated work
}

bar.stop()
```

### Custom Format

```ts
const bar = new cliProgress.SingleBar({
  format: 'Progress |{bar}| {percentage}% | {value}/{total} | ETA: {eta}s',
  barCompleteChar: '\u2588',
  barIncompleteChar: '\u2591',
  hideCursor: true
})

bar.start(100, 0)
```

### Multi-Bar

```ts
const multibar = new cliProgress.MultiBar({
  format: '{name} |{bar}| {percentage}%',
  barCompleteChar: '\u2588',
  barIncompleteChar: '\u2591'
})

const bar1 = multibar.create(100, 0, { name: 'Download' })
const bar2 = multibar.create(100, 0, { name: 'Process' })

bar1.increment()
bar2.increment()
```

## Spinner with Ora

### Basic Usage

```ts
import ora from 'ora'

const spinner = ora('Loading...').start()

try {
  await doSomething()
  spinner.succeed('Done!')
} catch (err) {
  spinner.fail('Failed!')
}
```

### Custom Spinner

```ts
import ora from 'ora'

const spinner = ora({
  text: 'Installing...',
  spinner: 'dots'
})

spinner.start()
```

## Complete Example

```ts
#!/usr/bin/env bun

import { Command } from 'commander'
import chalk from 'chalk'
import figlet from 'figlet'
import prompts from 'prompts'
import cliProgress from 'cli-progress'
import ora from 'ora'

// CLI Program
const program = new Command()

// ASCII Banner
figlet.textSync('My CLI', {
  font: 'Standard',
  horizontalLayout: 'default',
  verticalLayout: 'default'
}).split('\n').forEach(line => {
  console.log(chalk.blue(line))
})

console.log(chalk.gray('─'.repeat(40)))
console.log(chalk.gray('v1.0.0'))
console.log()

// Main command
program
  .name('my-cli')
  .description('A powerful CLI tool built with Bun')
  .version('1.0.0')

// Command: init
program
  .command('init')
  .description('Initialize a new project')
  .option('-n, --name <name>', 'Project name')
  .option('-t, --template <template>', 'Project template', 'default')
  .action(async (options) => {
    const spinner = ora('Initializing project...').start()

    // Get name interactively if not provided
    let name = options.name
    if (!name) {
      const response = await prompts({
        type: 'text',
        name: 'name',
        message: 'What is your project name?'
      })
      name = response.name
    }

    // Show template selection
    const template = options.template === 'default' 
      ? await prompts({
          type: 'select',
          name: 'template',
          message: 'Select a template',
          choices: [
            { title: 'Default', value: 'default' },
            { title: 'TypeScript', value: 'typescript' },
            { title: 'Vue', value: 'vue' }
          ]
        }).then(r => r.template)
      : options.template

    spinner.text = 'Installing dependencies...'

    // Simulate progress
    const progress = new cliProgress.SingleBar({}, cliProgress.presenter.pretty)
    progress.start(100, 0)

    for (let i = 0; i <= 100; i += 20) {
      await new Promise(r => setTimeout(r, 100))
      progress.update(i)
    }

    progress.stop()

    spinner.succeed(chalk.green('Project initialized!'))
    console.log()
    console.log(chalk.gray('─'.repeat(40)))
    console.log(chalk.bold('Project: ') + name)
    console.log(chalk.bold('Template: ') + template)
    console.log()
    console.log(chalk.green('✓ ') + 'Run ' + chalk.cyan(`bun install`) + ' to install dependencies')
    console.log(chalk.green('✓ ') + 'Run ' + chalk.cyan(`bun run dev`) + ' to start development')
  })

// Command: help
program
  .command('help-text')
  .description('Show help information')
  .action(() => {
    console.log(chalk.bold.yellow('My CLI Help'))
    console.log(chalk.gray('─'.repeat(40)))
    console.log(chalk.cyan('init') + chalk.gray('     ') + 'Initialize a new project')
    console.log(chalk.cyan('help-text') + chalk.gray('  ') + 'Show this help message')
    console.log()
  })

program.parse()
```

```bash
# Run the CLI
bun run src/index.ts

# Build and run
bun build src/index.ts --compile --outfile my-cli
chmod +x my-cli
./my-cli
./my-cli init
./my-cli help-text
```

## Recommended Dependencies

```json
{
  "dependencies": {
    "commander": "^11.0.0",
    "chalk": "^5.3.0",
    "figlet": "^1.7.0",
    "prompts": "^2.4.2",
    "cli-progress": "^3.12.0",
    "ora": "^8.0.0"
  },
  "devDependencies": {
    "@types/cli-progress": "^3.11.5",
    "@types/figlet": "^1.5.8"
  }
}
```

## Best Practices

1. **Use commander** for argument parsing - handles subcommands elegantly
2. **Use chalk for colors** - consistent terminal output styling
3. **Use prompts for interactivity** - better user experience than raw stdin
4. **Use ora for loading states** - clear feedback during async operations
5. **Use cli-progress for long operations** - shows progress for file downloads, etc.
6. **Build with --compile** for distribution - single executable, no runtime needed
