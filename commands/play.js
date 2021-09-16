const ytdl = require('ytdl-core');
const axios = require('axios');
const { validateURL } = require('ytdl-core');
const { MessageEmbed } = require('discord.js');
require('dotenv').config();

module.exports = {
    name: 'play',
    description: 'Play a song in your channel!',
    async execute(message) {
        try {
            const args = message.content.split(' ');
            const queue = message.client.queue;
            const serverQueue = message.client.queue.get(message.guild.id);

            const voiceChannel = message.member.voice.channel;
            if (!voiceChannel) {
                return message.channel.send(
                    'You need to be in a voice channel to play music!',
                );
            }
            const permissions = voiceChannel.permissionsFor(message.client.user);
            if (!permissions.has('CONNECT') || !permissions.has('SPEAK')) {
                return message.channel.send(
                    'I need the permissions to join and speak in your voice channel!',
                );
            }

            if (!serverQueue) {
                const queueContruct = {
                    textChannel: message.channel,
                    voiceChannel: voiceChannel,
                    connection: null,
                    songs: [],
                    volume: 5,
                    playing: true,
                };

                queue.set(message.guild.id, queueContruct);

                try {
                    const connection = await voiceChannel.join();
                    message.channel.send(`:thumbsup: **Joined \`${queueContruct.voiceChannel.name}\` :page_facing_up: And bound to \`${queueContruct.textChannel.name}\`**`);
                    const song = await this.searchMusic(message, args);
                    queueContruct.songs.push(song);
                    queueContruct.connection = connection;
                    this.play(message, queueContruct.songs[0]);
                }
                catch (err) {
                    console.log(err);
                    queue.delete(message.guild.id);
                    return message.channel.send(err);
                }
            }
            else {
                const song = await this.searchMusic(message, args);
                serverQueue.songs.push(song);
                console.log(song.thumbnail);
                const queueEmbed = new MessageEmbed()
                    .setTitle(song.title)
                    .setURL(song.url)
                    .setAuthor('Added to queue', message.author.avatarURL())
                    .setThumbnail(song.thumbnail)
                    .addFields(
                        { name: 'Channel', value: song.channel, inline: true },
                        { name: 'Song Duration', value: song.duration, inline: true },
                        { name: 'Estimated time until playing', value: song.duration, inline: true },
                    )
                    .addField('Position in queue', '1')
                    .setFooter('\u3000'.repeat(100) + '|');

                message.channel.send(queueEmbed);
                // return message.channel.send(
                //     `${song.title} has been added to the queue!`,
                // );
            }
        }
        catch (error) {
            console.log(error);
            message.channel.send(error.message);
        }
    },

    play(message, song) {
        const queue = message.client.queue;
        const guild = message.guild;
        const serverQueue = queue.get(message.guild.id);

        if (!song) {
            serverQueue.voiceChannel.leave();
            queue.delete(guild.id);
            return;
        }

        const dispatcher = serverQueue.connection
            .play(ytdl(song.url))
            .on('finish', () => {
                serverQueue.songs.shift();
                this.play(message, serverQueue.songs[0]);
            })
            .on('error', error => console.error(error));
        dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
        serverQueue.textChannel.send(`**Playing** :notes: \`${song.title}\` - Now!`);
    },

    async searchMusic(message, args) {
        let musicArg = (args.slice(1)).join(' ');
        if (!validateURL(musicArg)) {
            message.channel.send(`**Searching :mag_right: \`${musicArg}\`**`);
            const videoId = await axios.get(`https://www.googleapis.com/youtube/v3/search?key=${process.env.YOUTUBE_DATA_API}&type=video&part=snippet&maxResults=10&q=${musicArg}`)
                .then((response) => {
                    // console.log(response.data.items[0].id.videoId);
                    return (response.data.items[0].id.videoId);
                }, (error) => {
                    console.log(error);
                });

            musicArg = `https://youtu.be/${videoId}`;
        }

        console.log(musicArg);

        const songInfo = await ytdl.getInfo(musicArg);
        const song = {
            title: songInfo.videoDetails.title,
            url: songInfo.videoDetails.video_url,
            channel: songInfo.videoDetails.ownerChannelName,
            duration: songInfo.videoDetails.lengthSeconds,
            thumbnail: songInfo.videoDetails.thumbnails[0].url,
        };
        return song;
    },
};
