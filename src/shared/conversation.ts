import { v4 } from "uuid";

export interface IConversation {
  id: string;
  recordings: IRecording[];
}

export interface IMessage {
  role: "user" | "assistant";
  content: string;
}

export class Conversation {
  public recordings: Recording[] = [];
  public messages: IMessage[] = [];

  private constructor(private readonly id: string) {}

  static fromConversation(
    conversation: Conversation,
    updates: Partial<{ recordings: Recording[]; messages: IMessage[] }>,
  ) {
    const newConversation = new Conversation(conversation.id);
    newConversation.recordings = updates.recordings || conversation.recordings;
    newConversation.messages = updates.messages || conversation.messages;

    return newConversation;
  }

  static toJSON(conversation: Conversation) {
    return {
      id: conversation.id,
      recordings: conversation.recordings.map((r) => Recording.toJSON(r)),
      messages: conversation.messages,
    };
  }

  static fromJSON(json: any) {
    const conversation = new Conversation(json.id);
    conversation.recordings = json.recordings.map((r: any) => Recording.fromJSON(r));
    conversation.messages = json.messages;
    return conversation;
  }

  addImageContextToCurrentRecording(screenshot: string) {
    const currentRecording = this.currentRecording();
    if (!currentRecording) return this;
    return Conversation.fromConversation(this, {
      recordings: this.recordings.map((r) =>
        r.id === currentRecording.id ? currentRecording.addImageContext(screenshot) : r,
      ),
    });
  }

  addTextContextToCurrentRecording(text: string) {
    const currentRecording = this.currentRecording();
    if (!currentRecording) return this;
    return Conversation.fromConversation(this, {
      recordings: this.recordings.map((r) =>
        r.id === currentRecording.id ? currentRecording.addTextContext(text) : r,
      ),
    });
  }

  addAudioToCurrentRecording(audio: Float32Array) {
    const currentRecording = this.currentRecording();
    if (!currentRecording) return this;
    return Conversation.fromConversation(this, {
      recordings: this.recordings.map((r) => (r.id === currentRecording.id ? currentRecording.addAudio(audio) : r)),
    });
  }

  addTranscriptionToCurrentRecording(transcription: string) {
    const currentRecording = this.currentRecording();
    if (!currentRecording) return this;
    return Conversation.fromConversation(this, {
      recordings: this.recordings.map((r) =>
        r.id === currentRecording.id ? currentRecording.setTranscription(transcription) : r,
      ),
      messages: [...this.messages, { role: "user", content: transcription }],
    });
  }

  currentRecording(): Recording | null {
    return this.recordings[this.recordings.length - 1] ?? null;
  }

  addRecording(recording: Recording) {
    return Conversation.fromConversation(this, {
      recordings: [...this.recordings, recording],
    });
  }

  static createWithUniqueId() {
    return new Conversation(v4());
  }
}

export interface IRecording {
  id: string;
  language: string;
  imageContext: string | null;
  textContext: string | null;
  audio: Float32Array | null;
  transcription: string | null;
}

export class Recording {
  public imageContext: string | null = null;
  public textContext: string | null = null;
  public audio: Float32Array | null = null;
  public transcription: string | null = null;
  private constructor(
    public readonly id: string,
    public readonly language: string,
  ) {}

  static createWithUniqueId({ language }: { language: string }) {
    return new Recording(v4(), language);
  }

  static fromRecording(
    recording: Recording,
    updates: Partial<{
      imageContext: string | null;
      textContext: string | null;
      audio: Float32Array | null;
      transcription: string | null;
    }>,
  ) {
    const newRecording = new Recording(recording.id, recording.language);
    newRecording.imageContext = updates.imageContext || recording.imageContext;
    newRecording.transcription = updates.transcription || recording.transcription;
    newRecording.textContext = updates.textContext || recording.textContext;
    newRecording.audio = updates.audio || recording.audio;
    return newRecording;
  }

  static toJSON(recording: Recording) {
    return {
      id: recording.id,
      language: recording.language,
      imageContext: recording.imageContext,
      transcription: recording.transcription,
      textContext: recording.textContext,
      audio: null,
    };
  }

  static fromJSON(json: any) {
    const recording = new Recording(json.id, json.language);
    recording.imageContext = json.imageContext;
    recording.transcription = json.transcription;
    recording.textContext = json.textContext;
    return recording;
  }

  addImageContext(screenshot: string) {
    return Recording.fromRecording(this, { imageContext: screenshot });
  }
  addTextContext(copy: string) {
    return Recording.fromRecording(this, { textContext: copy });
  }
  addAudio(audio: Float32Array) {
    return Recording.fromRecording(this, { audio: audio });
  }
  setTranscription(transcription: string) {
    return Recording.fromRecording(this, { transcription: transcription });
  }
}
