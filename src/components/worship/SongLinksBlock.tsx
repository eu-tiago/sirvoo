import { ExternalLink, Music2, Youtube, FileMusic, Disc3, Headphones } from "lucide-react";
import type { Song } from "@/hooks/useSongs";

type SongLike = Partial<Song> & { title: string; original_key?: string | null };

export function SongLinks({ song, className = "" }: { song: SongLike; className?: string }) {
  const links: { href: string | null | undefined; label: string; Icon: any }[] = [
    { href: song.spotify_url, label: "Spotify", Icon: Disc3 },
    { href: song.youtube_url, label: "YouTube", Icon: Youtube },
    { href: song.cifra_url, label: "Cifra", Icon: FileMusic },
    { href: song.multitracks_url, label: "Multitracks", Icon: Music2 },
    { href: song.playback_url, label: "Playback", Icon: Headphones },
  ];
  const visible = links.filter((l) => !!l.href);
  if (!visible.length) return null;
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {visible.map(({ href, label, Icon }) => (
        <a
          key={label}
          href={href!}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-muted hover:bg-muted/70 text-foreground/80"
        >
          <Icon className="w-3 h-3" />
          {label}
          <ExternalLink className="w-3 h-3 opacity-60" />
        </a>
      ))}
    </div>
  );
}
